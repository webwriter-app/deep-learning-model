import * as tf from '@tensorflow/tfjs';
import { html, css, TemplateResult, PropertyValues } from "lit"

type RawSample = Record<string, string>
type TensorSample = Record<string, tf.Tensor>

type Constructor<T> = new (...args: any[]) => T;
type NonEmptyArray<T> = [T, ...T[]];


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
    protected trainingEnd: number;
    /**
    * The end of the validation section (index excluded)
    */
    protected validationEnd: number;
    /**
     * The fields/column names of the dataset table
     * (Note: This is captured only by the first entry of the datasets keys)
     */
    public readonly fields: Array<string>;

    /**
    * This class is a wrapper that references the original data and allows to access samples, batches and training/validation/testing splits
    */
    constructor(dataset: Array<RawSample>, trainingPercentile = 0.7, validationPercentile = 0.2) {
        this.dataset = dataset;
        this.fields = Object.keys(dataset[0]);
        tf.util.shuffle(this.dataset);
        this.trainingEnd = this.dataset.length * trainingPercentile;
        this.validationEnd = this.dataset.length * (trainingPercentile + validationPercentile);
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
}

/**
* This class describes a transformation function from a column in the dataset from string values to tensors
*/
export abstract class FeatureTransformation {
    /**
    * The information gathered from one run through all samples. This could be the max, avg or the list of unique classes.
    */
    protected aggrigatedInformation: Record<string, any> = {};
    public readonly name: string;

    /**
    * The constructor runs through the samples and aggregates needed information.
    */
    public constructor(name: string, samples: Array<string>) {
        this.name = name;
    }

    /**
     * The size of tensor after the transformation
     */
    public abstract size(): NonEmptyArray<number>;

    /**
     * Takes a string value from the raw data and turns it into a tensor
     * @param value The string value from the raw data that will be turned into a tensor
     */
    public abstract transform(value: string): tf.Tensor

    /**
     * Returns the element that will be displayed and changes the settings of the transformation
     */
    public abstract getSettingElement(): TemplateResult;

    /**
     * Returns an html element that will be displayed. Can be a simple text or an image etc.
     */
    public abstract renderTransformedValue(value: string): TemplateResult;
}

type FeatureTransformationRegistryEntry = {
    name: string,
    constructor: Constructor<FeatureTransformation>
}
let registeredTransformations = new Array<FeatureTransformationRegistryEntry>
/**
 * Registers a feature transformation (also for external classes). Primarly used to select the available transformations in the UI
 * @param name Name of the transformation in literature
 * @param constructor The class instantiated when the transformation is used
 */
export function registerFeatureTransformation(name: string, constructor: Constructor<FeatureTransformation>) {
    registeredTransformations.push({ name, constructor })
}

/**
 * Returns the available feature transformations registered by the classes
 */
export function getFeatureTransformations(): Array<FeatureTransformationRegistryEntry> {
    return registeredTransformations;
}

/**
 * Returns the available feature transformations registered by the classes
 */
export function getFeatureTransformation(name: string): FeatureTransformationRegistryEntry {
    return registeredTransformations.find(e => e.name == name);
}
registerFeatureTransformation("Ignore", null)

/**
* This is the transformation from string values to a class encoding
*/
export class ClassTransformation extends FeatureTransformation {
    /**
    * The constructor runs through the samples and registers the unique classes.
    */
    public constructor(samples: Array<string>) {
        super("Class Encoding", samples);
        this.aggrigatedInformation.classes = new Array<string>();
        for (let sample of samples) {
            let classes = this.aggrigatedInformation.classes;
            if (classes.indexOf(sample) == -1)
                classes.push(sample);
        }
    }

    public size(): [number] {
        return [(this.aggrigatedInformation.classes.length as number)];
    }

    public transform(value: string): tf.Tensor1D {
        let classes = this.aggrigatedInformation.classes;
        let index = classes.indexOf(value);
        if (index == -1)
            return tf.zeros(this.size());

        let tensor = new Array<number>(classes.length);
        tensor.fill(0);
        tensor[index] = 1;
        return tf.tensor(tensor);
    }

    public getSettingElement(): TemplateResult {
        function typechange() {

        }
        return html`
            <h2>Value Scale</h2>
            <sl-select @sl-change=${typechange}>
                <sl-option>Linear</sl-option>
                <sl-option>Exponential</sl-option>
            </sl-select>
        `
    }

    public renderTransformedValue(value: string): TemplateResult {
        let transformed = this.transform(value).arraySync();
        if (transformed.length < 10) {
            return html`${transformed.join(", ")}`;
        } else {
            let before = transformed.indexOf(1);
            let after = (transformed.length - transformed.indexOf(1) - 1)
            let str = (before > 0 ? "0x" + before + ", " : "") + "1" + (after > 0 ? ", 0x" + after : "");
            return html`${str}`;
        }
    }
}
registerFeatureTransformation("Class Encoding", ClassTransformation)

/**
* This is the transformation from string values to a class encoding
*/
export class LinearTransformation extends FeatureTransformation {
    /**
    * The constructor runs through the samples and registers the unique classes.
    */
    public constructor(samples: Array<string>) {
        super("Number Encoding", samples);
        if (isNaN(parseFloat(samples[0])))
            throw new Error("number transformation contained invalid numbers")
        this.aggrigatedInformation.max = parseFloat(samples[0]);
        this.aggrigatedInformation.min = parseFloat(samples[0]);
        for (let sample of samples) {
            let number = parseFloat(sample);
            if (isNaN(number))
                throw new Error("number transformation contained invalid numbers")

            let min = this.aggrigatedInformation.min;
            let max = this.aggrigatedInformation.max;
            if (number > max)
                this.aggrigatedInformation.max = number;
            if (number < min)
                this.aggrigatedInformation.min = number;
        }
        if (this.aggrigatedInformation.min - this.aggrigatedInformation.max == 0)
            throw new Error("the provided values are all the same and thus do not offer any information")
    }

    public size() {
        return [1] as NonEmptyArray<number>;
    }

    public transform(value: string): tf.Tensor1D {
        let min = this.aggrigatedInformation.min;
        let max = this.aggrigatedInformation.max;
        let tensor = new Array<number>(1)
        let number = parseFloat(value);
        if (isNaN(number))
            throw new Error("number transformation contained invalid numbers")

        tensor[0] = (number - min) / (max - min)
        return tf.tensor(tensor);
    }

    public getSettingElement(): TemplateResult {
        return html``
    }

    public renderTransformedValue(value: string): TemplateResult {
        return html`${this.transform(value).arraySync()[0].toFixed(3)}`;
    }
}
registerFeatureTransformation("Number Encoding", LinearTransformation)

/**
* This is the transformation from string values to an image
*/
export class ImageTransformation extends FeatureTransformation {
    /**
    * The constructor runs through the samples and registers the unique classes.
    */
    public constructor(samples: Array<string>) {
        super("Image Encoding", samples);
    }

    public size() {
        return [1] as NonEmptyArray<number>;
    }

    public transform(value: string): tf.Tensor2D {
        return tf.tensor([0]);
    }

    public getSettingElement(): TemplateResult {
        return html``
    }

    public renderTransformedValue(value: string): TemplateResult {
        function binaryStringToUint8Array(str: string): Uint8Array {
            const len = str.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = str.charCodeAt(i) & 0xFF;
            }
            return bytes;
        }

        let bytes = binaryStringToUint8Array(JSON.parse(value).bytes);
        const blob = new Blob([bytes], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);
        return html`<img src=${imageUrl}>`;
    }
}
registerFeatureTransformation("Number Encoding", LinearTransformation)

/**
* This class is a wrapper that refferences the original dataset and any accessed Sample will be transformed and delivered as tensors
*/
export class TransformedDataset {
    public readonly dataset: Dataset;
    public featureMaps: Record<string, FeatureTransformation> = {};
    private cache: Record<string, Array<TensorSample>> = {};

    /**
    * This class is a wrapper that refferences the original dataset and any accessed Sample will be transformed and delivered as tensors
    */
    constructor(dataset: Dataset, featureMaps: Record<string, Constructor<FeatureTransformation>>) {
        this.dataset = dataset;
        for (let key in featureMaps) {
            let FeatureTransformationConstructor = featureMaps[key];
            try {
                this.featureMaps[key] = new FeatureTransformationConstructor(dataset.getSamples().map(v => v[key]))
            } catch (e) {

            }
        }
    }

    /**
     * Transforms the raw sample into a tensor sample
     * @param sample The sample that should be transformed
     */
    transformSample(sample: RawSample): TensorSample {
        let tensors: TensorSample = {}
        for (let key in sample) {
            let transformation = this.featureMaps[key];
            if (transformation)
                tensors[key] = transformation.transform(sample[key])
        }
        return tensors;
    }

    /**
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    getSample(id: number): TensorSample {
        let sample = this.dataset.getSample(id);
        return this.transformSample(sample);
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getTrainingSamples(): Array<TensorSample> {
        if (this.cache.training != null)
            return this.cache.training;

        let that = this;
        this.cache.training = this.dataset.getTrainingSamples().map(function (sample: RawSample) {
            return that.transformSample(sample);
        });
        return this.cache.training;
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getValidationSamples(): Array<TensorSample> {
        if (this.cache.validation != null)
            return this.cache.validation;

        let that = this;
        this.cache.validation = this.dataset.getValidationSamples().map(function (sample: RawSample) {
            return that.transformSample(sample);
        });
        return this.cache.validation;
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    getTestSamples(): Array<TensorSample> {
        if (this.cache.testing != null)
            return this.cache.testing;

        let that = this;
        this.cache.testing = this.dataset.getTestSamples().map(function (sample: RawSample) {
            return that.transformSample(sample);
        });
        return this.cache.testing;
    }
}