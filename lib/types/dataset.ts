import * as tf from '@tensorflow/tfjs';

type RawSample = Map<string,string>
type TensorSample = Map<string,tf.Tensor>

type Constructor<T> = new (...args: any[]) => T;

/**
* This class is a wrapper that refferences the original data and allows to access samples, batches and training/validation/testing splits
*/
export class Dataset {

    /**
    * The original dataset
    */
    protected dataset: Array<RawSample>;
    /**
    * The end of the training section (index excluded)
    */
    protected trainingEnd: number;
    /**
    * The end of the validation section (index excluded)
    */
    protected validationEnd: number;

    /**
    * This class is a wrapper that references the original data and allows to access samples, batches and training/validation/testing splits
    */
    constructor(dataset: Array<Map<string,string>>, trainingPercentile = 0.7, validationPercentile = 0.2) {
        this.dataset = dataset;
        tf.util.shuffle(this.dataset);
        this.trainingEnd = this.dataset.length * trainingPercentile;
        this.validationEnd = this.dataset.length * (trainingPercentile + validationPercentile);
    }

    /**
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    getSample(id:number):RawSample {
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
}

export abstract class FeatureTransformation {
    /**
    * The information gathered from one run through all samples. This could be the max, avg or the list of unique classes.
    */
    private aggrigatedInformation: object;

    /**
    * The constructor runs through the samples and aggregates needed information.
    */
    public constructor(samples: Array<string>)  {}

    /**
     * Takes a string value from the raw data and turns it into a tensor
     * @param value The string value from the raw data that will be turned into a tensor
     */
    public abstract transform(value: string): tf.Tensor
}

/**
* This class is a wrapper that refferences the original dataset and any accessed Sample will be transformed and delivered as tensors
*/
export class TransformedDataset {
    private dataset: Dataset;
    public featureMaps: Map<string, FeatureTransformation>;
    private cache: Map<string, Array<TensorSample>>;

    /**
    * This class is a wrapper that refferences the original dataset and any accessed Sample will be transformed and delivered as tensors
    */
    constructor(dataset: Dataset, featureMaps: Map<string, Constructor<FeatureTransformation>>) {
        this.dataset = dataset;
        for (let key in featureMaps) {
            let FeatureTransf = featureMaps[key];
            this.featureMaps[key] = new FeatureTransf(dataset.getSamples().map(v => v[key]))
        }
    }

    /**
     * Transforms the raw sample into a tensor sample
     * @param sample The sample that should be transformed
     */
    transformSample(sample: RawSample):TensorSample {
        let tensors = new Map<string, tf.Tensor>()
        for (let key in sample) {
            tensors[key] = this.featureMaps.get("key").transform(sample.get(key))
        }
        return tensors;
    }

    /**
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    getSample(id:number):TensorSample {
        let sample = this.dataset.getSample(id);
        return this.transformSample(sample);
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getTrainingSamples(): Array<TensorSample> {
        if (this.cache.get("training") != null)
            return this.cache.get("training");

        let that = this;
        this.cache.set("training", this.dataset.getTrainingSamples().map(function(sample: RawSample) {
            return that.transformSample(sample);
        }));
        return this.cache.get("training");
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getValidationSamples(): Array<TensorSample> {
        if (this.cache.get("validation") != null)
            return this.cache.get("validation");

        let that = this;
        this.cache.set("validation", this.dataset.getValidationSamples().map(function(sample: RawSample) {
            return that.transformSample(sample);
        }));
        return this.cache.get("validation");
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getTestSamples(): Array<TensorSample> {
        if (this.cache.get("testing") != null)
            return this.cache.get("testing");

        let that = this;
        this.cache.set("testing", this.dataset.getTestSamples().map(function(sample: RawSample) {
            return that.transformSample(sample);
        }));
        return this.cache.get("testing");
    }
}