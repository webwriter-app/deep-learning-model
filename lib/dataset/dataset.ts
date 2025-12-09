import { FeatureSettings, FeatureTransformation } from './feature';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

type RawSample = Record<string, string>
type TensorSample = Record<string, TF.Tensor>

type Constructor<T> = new (...args: any[]) => T;

/**
* This class is a wrapper that references the original data and allows to access samples, batches and training/validation/testing splits
*/
export class Dataset {

    /**
    * The original dataset
    */
    protected dataset: Array<RawSample>;
    /**
    * The end of the training section (index excluded)
    */
    public readonly trainingEnd: number;
    /**
    * The end of the validation section (index excluded)
    */
    public readonly validationEnd: number;
    /**
     * The fields/column names of the dataset table
     * (Note: This is captured only by the first entry of the datasets keys)
     */
    public readonly fields: Array<string>;

    /**
    * This class is a wrapper that references the original data and allows to access samples, batches and training/validation/testing splits
    */
    constructor(dataset: Array<RawSample>, trainingPercentile = 0.7, validationPercentile = 0.2, limit = 10000) {
        this.dataset = dataset.slice(0, limit);
        this.fields = Object.keys(dataset[0]);
        tf.util.shuffle(this.dataset);
        this.trainingEnd = Math.floor(this.dataset.length * trainingPercentile);
        this.validationEnd = Math.floor(this.dataset.length * (trainingPercentile + validationPercentile));
    }

    /**
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    getSample(id: number): RawSample {
        return this.dataset[id];
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getSamples(): Array<RawSample> {
        return this.dataset;
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getTrainingSamples(): Array<RawSample> {
        return this.dataset.slice(0, this.trainingEnd);
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getValidationSamples(): Array<RawSample> {
        return this.dataset.slice(this.trainingEnd, this.validationEnd);
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getTestSamples(): Array<RawSample> {
        return this.dataset.slice(this.validationEnd);
    }

    length() {
        return this.dataset.length;
    }
}

/**
* This class is a wrapper that refferences the original dataset and any accessed Sample will be transformed and delivered as tensors
*/
export class TransformedDataset {
    public readonly dataset: Dataset;
    public featureMaps: Record<string, FeatureTransformation> = {};
    private cache: Array<TensorSample> = [];

    /**
    * This class is a wrapper that refferences the original dataset and any accessed Sample will be transformed and delivered as tensors
    */
    constructor(dataset: Dataset, featureMaps: Record<string, Constructor<FeatureTransformation>>, settings: Record<string, FeatureSettings>) {
        this.dataset = dataset;
        for (let field in featureMaps) {
            let FeatureTransformationConstructor = featureMaps[field];
            try {
                this.featureMaps[field] = new FeatureTransformationConstructor(dataset.getSamples().map(v => v[field]), settings[field])
            } catch (e) {
                console.log(e);
            }
        }
    }

    /**
     * Transforms the raw sample into a tensor sample
     * @param sample The sample that should be transformed
     */
    async transformSample(sample: RawSample): Promise<TensorSample> {
        let tensors: TensorSample = {}
        let keys: string[] = [];
        let promisses: Promise<TF.Tensor>[] = []
        for (let key in sample) {
            let transformation = this.featureMaps[key];
            if (transformation) {
                keys.push(key);
                promisses.push(transformation.transform(sample[key]));
                tensors[key] = await transformation.transform(sample[key])
            }
        }
        let finished = await Promise.all(promisses);
        for (let i = 0; i < keys.length; i++) {
            tensors[keys[i]] = finished[i];
        }
        return tensors;
    }

    /**
     * Transforms the raw sample into a tensor sample
     * @param sample The sample that should be transformed
     */
    async transformAndFilterSample(sample: RawSample, inFields: Set<string>, outFields: Set<string>): Promise<TensorSample> {
        let tensors: TensorSample = {}
        let keys: string[] = [];
        let promisses: Promise<TF.Tensor>[] = []
        for (let key in sample) {
            if (!inFields.has(key) && !outFields.has(key))
                continue;
            let transformation = this.featureMaps[key];
            if (transformation) {
                keys.push(key);
                promisses.push(transformation.transform(sample[key]));
            }
        }
        let finished = await Promise.all(promisses);
        for (let i = 0; i < keys.length; i++) {
            tensors[keys[i]] = finished[i];
        }
        return tensors;
    }

    /**
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    async getSample(id: number, enableCache=false): Promise<TensorSample> {
        if (enableCache) {
            function cloneSample(sample){
                let out = {};
                for (let field in sample) {
                    out[field] = sample[field].clone();
                }
                return out;
            }
            
            if (this.cache[id] != null) {
                return cloneSample(this.cache[id])
            }

            let sample = this.dataset.getSample(id);
            this.cache[id] = await this.transformSample(sample);
            return cloneSample(this.cache[id]);
        } else {
            let sample = this.dataset.getSample(id);
            return await this.transformSample(sample);
        }
    }

    /**
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    async getSampleAsInputsOutputs(id: number, inFields: Set<string>, outFields: Set<string>, enableCache=false): Promise<{inputs:TensorSample, outputs:TensorSample}> {
        if (enableCache) {
            function cloneSample(sample){
                let outputs = {};
                let inputs = {};
                for (let field in sample) {
                    if (inFields.has(field))
                        inputs["in_" + field] = sample[field].clone();
                    if (outFields.has(field))
                        outputs["out_" + field] = sample[field].clone();
                }
                return {inputs, outputs};
            }
            
            if (this.cache[id] != null) {
                return cloneSample(this.cache[id])
            }

            let sample = this.dataset.getSample(id);
            this.cache[id] = await this.transformAndFilterSample(sample, inFields, outFields);
            return cloneSample(this.cache[id]);
        } else {
            function mapSample(sample){
                let outputs = {};
                let inputs = {};
                for (let field in sample) {
                    if (inFields.has(field))
                        inputs["in_" + field] = sample[field];
                    if (outFields.has(field))
                        outputs["out_" + field] = sample[field];
                }
                return {inputs, outputs};
            }

            let sample = this.dataset.getSample(id);
            return mapSample(await this.transformAndFilterSample(sample, inFields, outFields));
        }
    }

    /**
     * Returns a generator for the training portion of the dataset
     */
    getTrainingDataGenerator(inFields: Set<string>, outFields: Set<string>, enableCache=false): () => AsyncGenerator<{ xs: TensorSample; ys: TensorSample }> {
        let that = this;
        async function* dataGenerator() {
            const numElements = that.dataset.trainingEnd;
            let index = 0;

            while (index < numElements) {
                const sample = await that.getSampleAsInputsOutputs(index, inFields, outFields, enableCache);
                yield {xs:sample.inputs, ys: sample.outputs};
                index++;
            }
        }
        return dataGenerator;
    }

    /**
     * Returns a generator for the training portion of the dataset
     */
    getValidationDataGenerator(inFields: Set<string>, outFields: Set<string>, enableCache=false): () => AsyncGenerator<{ xs: TensorSample; ys: TensorSample }> {
        let that = this;
        async function* dataGenerator() {
            const numElements = that.dataset.validationEnd;
            let index = that.dataset.trainingEnd;
            while (index < numElements) {
                const sample = await that.getSampleAsInputsOutputs(index, inFields, outFields, enableCache);
                yield {xs:sample.inputs, ys: sample.outputs};
                index++;
            }
        }
        return dataGenerator;
    }

    /**
     * Returns a generator for the training portion of the dataset
     */
    getTestDataGenerator(inFields: Set<string>, outFields: Set<string>, enableCache=false): () => AsyncGenerator<{ xs: TensorSample; ys: TensorSample }> {
        let that = this;
        async function* dataGenerator() {
            const numElements = that.dataset.length();
            let index = that.dataset.validationEnd;
            while (index < numElements) {
                const sample = await that.getSampleAsInputsOutputs(index, inFields, outFields, enableCache);
                yield {xs:sample.inputs, ys: sample.outputs};
                index++;
            }
        }
        return dataGenerator;
    }
    
    clearCache() {
        this.cache.forEach(function(sample) {
            Object.values(sample).forEach(t => t.dispose())
        })
        this.cache = [];
    }

    length() {
        return this.dataset.length();
    }
}