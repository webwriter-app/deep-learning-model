import { SlInput, SlSelect } from '@shoelace-style/shoelace';
import * as tf from '@tensorflow/tfjs';
import { html, css, TemplateResult, PropertyValues } from "lit"
import { until } from 'lit/directives/until.js';

type RawSample = Record<string, string>
type TensorSample = Record<string, tf.Tensor>

type Constructor<T> = new (...args: any[]) => T;
type NonEmptyArray<T> = [T, ...T[]];

type FeatureSettings = Record<string, any> | null;
type ImageChannel = Uint8ClampedArray[];
type ImageData = [ImageChannel, ImageChannel, ImageChannel, ImageChannel]

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
    protected settings: Record<string, any>;

    /**
    * The constructor runs through the samples and aggregates needed information.
    */
    public constructor(name: string, samples: Array<string>, settings: FeatureSettings) {
        this.name = name;
        if (settings)
            this.settings = settings;
        else
            this.settings = {};
    }

    /**
     * The size of tensor after the transformation
     */
    public abstract size(): NonEmptyArray<number>;

    /**
     * Takes a string value from the raw data and turns it into a tensor
     * @param value The string value from the raw data that will be turned into a tensor
     */
    public abstract transform(value: string): Promise<tf.Tensor>;

    /**
     * Returns the element that will be displayed and changes the settings of the transformation
     */
    public abstract getSettingElement(changeCallback: (settings: FeatureSettings) => void): TemplateResult;

    /**
     * Returns an html element that will be displayed. Can be a simple text or an image etc.
     */
    public abstract renderTransformedValue(value: string): TemplateResult;

    public getSetting(name: string) {
        return this.settings[name];
    }
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
    public constructor(samples: Array<string>, settings: FeatureSettings) {
        super("Class Encoding", samples, settings);
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

    public async transform(value: string): Promise<tf.Tensor1D> {
        value = JSON.parse(value);
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
        return html``
    }

    public renderTransformedValue(value: string): TemplateResult {
        return html`${until(
            (async () => {
                let transformed = (await this.transform(value)).arraySync();
                if (transformed.length < 10) {
                    return html`${transformed.join(", ")}`;
                } else {
                    let before = transformed.indexOf(1);
                    let after = (transformed.length - transformed.indexOf(1) - 1)
                    let str = (before > 0 ? "0x" + before + ", " : "") + "1" + (after > 0 ? ", 0x" + after : "");
                    return html`${str}`;
                }
            })(), html`Loading`)}`;
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
    public constructor(samples: Array<string>, settings: FeatureSettings) {
        super("Number Encoding", samples, settings);
        if (isNaN(parseFloat(samples[0])))
            throw new Error("number transformation contained invalid numbers")

        if (!this.settings.type)
            this.settings.type = "linear";

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

    public async transform(value: string): Promise<tf.Tensor1D> {
        value = JSON.parse(value);
        let min = this.aggrigatedInformation.min;
        let max = this.aggrigatedInformation.max;
        let tensor = new Array<number>(1)
        let number = parseFloat(value);
        if (isNaN(number))
            throw new Error("number transformation contained invalid numbers")

        if (this.settings.type == "linear")
            tensor[0] = (number - min) / (max - min)
        if (this.settings.type == "exp")
            tensor[0] = Math.log(((number - min) / (max - min)) * (Math.E - 1) + 1)
        if (this.settings.type == "quad")
            tensor[0] = Math.sqrt((number - min) / (max - min))
        return tf.tensor(tensor);
    }

    public getSettingElement(changeCallback): TemplateResult {
        let that = this;
        function typechange(e: Event) {
            let element = e.target as SlSelect;
            let type = element.value;
            that.settings.type = type;
            changeCallback(that.settings);
        }
        return html`
            <sl-select label="Value Scale" @sl-change=${typechange} value=${this.settings.type}>
                <sl-option value="linear">Linear</sl-option>
                <sl-option value="exp">Exponential</sl-option>
                <sl-option value="quad">Quadratic</sl-option>
            </sl-select>`
    }

    public renderTransformedValue(value: string): TemplateResult {
        return html`${until(
            (async () => { return (await this.transform(value)).arraySync()[0].toFixed(3) })(), html`Loading`)}`;
    }
}
registerFeatureTransformation("Number Encoding", LinearTransformation)

/**
* This is the transformation from string values to an image
*/
export class ImageTransformation extends FeatureTransformation {
    private widthElement: SlInput;
    private heightElement: SlInput;

    /**
    * The constructor runs through the samples and registers the unique classes.
    */
    public constructor(samples: Array<string>, settings: FeatureSettings) {
        super("Image Encoding", samples, settings);

        if (!this.settings.shema)
            this.settings.shema = "binary";
        if (!this.settings.width)
            this.settings.width = 0;
        if (!this.settings.height)
            this.settings.height = 0;
        if (!this.settings.transform)
            this.settings.transform = "identity";

        let that = this;
        this.getRawImage(JSON.stringify(samples[0])).onload = function (e: Event) {
            let img = e.target as HTMLImageElement;
            if (that.settings.width == 0) {
                that.settings.width = img.width;
                if (that.widthElement) {
                    that.widthElement.value = String(img.width);
                    that.widthElement.max = img.width;
                }
            }
            if (that.settings.height == 0) {
                that.settings.height = img.height;
                if (that.heightElement) {
                    that.heightElement.value = String(img.height);
                    that.heightElement.max = img.height;
                }
            }
        }
    }

    public size() {
        let channels = 4;
        if (this.settings.transform == "grayscale")
            channels = 1;
        return [this.settings.width, this.settings.height, channels] as NonEmptyArray<number>;
    }

    public async transform(value: string): Promise<tf.Tensor2D> {
        let img = this.getImagePixels(await this.getImage(value));
        return tf.tensor(img);
    }

    private getImagePixels(image: HTMLImageElement): ImageData {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;

        const R = Array.from({ length: canvas.height }, () => new Uint8ClampedArray(canvas.width));
        const G = Array.from({ length: canvas.height }, () => new Uint8ClampedArray(canvas.width));
        const B = Array.from({ length: canvas.height }, () => new Uint8ClampedArray(canvas.width));
        const A = Array.from({ length: canvas.height }, () => new Uint8ClampedArray(canvas.width));

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                let idx = (y * canvas.width + x) * 4;
                R[y][x] = data[idx];
                G[y][x] = data[idx + 1];
                B[y][x] = data[idx + 2];
                A[y][x] = data[idx + 3];
            }
        }

        return [R, G, B, A]
    }

    private transformImage(img: HTMLImageElement, width: number, height: number) {
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (this.settings.transform == "grayscale") {
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                let gray = 0.3 * r + 0.59 * g + 0.11 * b;

                data[i] = data[i + 1] = data[i + 2] = gray;
            }

            ctx.putImageData(imageData, 0, 0);
        }

        let outImg = document.createElement("img");
        outImg.src = canvas.toDataURL();
        return outImg;
    }

    public getSettingElement(changeCallback): TemplateResult {
        let that = this;
        function typechange(e: Event) {
            let element = e.target as HTMLInputElement;
            let value = element.value;
            that.settings[element.name] = value;
            changeCallback(that.settings);
        }
        this.widthElement = document.createElement("sl-input");
        this.widthElement.type = "number"
        this.widthElement.label = "Width";
        this.widthElement.value = this.settings.width;
        this.widthElement.addEventListener("sl-change", typechange);
        this.widthElement.max = this.settings.width;
        this.widthElement.min = 1;
        this.widthElement.name = "width";

        this.heightElement = document.createElement("sl-input");
        this.heightElement.type = "number"
        this.heightElement.label = "Height";
        this.heightElement.value = this.settings.height;
        this.heightElement.addEventListener("sl-change", typechange);
        this.heightElement.max = this.settings.height;
        this.heightElement.min = 1;
        this.heightElement.name = "height";

        return html`
        <sl-select name="shema" value=${this.settings.shema} @sl-change=${typechange} label="Import Format">
            <sl-option value="binary">Binary String</sl-option>
            <sl-option value="base64">Base64 String</sl-option>
        </sl-select>
        ${this.widthElement}${this.heightElement}
        <sl-select name="transform" value=${this.settings.transform} @sl-change=${typechange} label="Image Pre-Processing">
            <sl-option value="identity">Identity</sl-option>
            <sl-option value="grayscale">Grayscale</sl-option>
        </sl-select>`;
    }

    public async getImage(value: string): Promise<HTMLImageElement> {
        let img = this.getRawImage(value);
        await (new Promise(function (res, rej) {
            img.onload = res;
        }))
        let scaled = this.transformImage(img, this.settings.width, this.settings.height);
        return scaled;
    }

    public getRawImage(value: string): HTMLImageElement {
        let bytes = new Uint8Array(JSON.parse(value));
        let blob = new Blob([bytes], { type: 'image/png' });
        let imageUrl = URL.createObjectURL(blob);
        let img = new Image();
        img.src = imageUrl;
        return img;
    }

    private async waitUntilImageDimensionsAvailable() {
        let that = this;
        return new Promise(function (res, rej) {
            let inter = setInterval(function () {
                if (that.settings.width != 0 && that.settings.height != 0) {
                    clearInterval(inter);
                    res(null);
                }
            }, 10);
        })
    }

    public renderTransformedValue(value: string): TemplateResult {
        return html`${until(
            (async () => {
                await this.waitUntilImageDimensionsAvailable();
                let img = await this.getImage(value);
                return img;
            })(),
            html`Loading image`)
            }`;
    }
}
registerFeatureTransformation("Image Encoding", ImageTransformation)

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
        let promisses: Promise<tf.Tensor>[] = []
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
     * Returns a sample from the dataset
     * (note: the dataset is shuffled)
     * @param id The id of the sample
     */
    async getSample(id: number): Promise<TensorSample> {
        let sample = this.dataset.getSample(id);
        return this.transformSample(sample);
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    async getTrainingSamples(): Promise<TensorSample[]> {
        if (this.cache.training != null)
            return this.cache.training;

        let that = this;
        this.cache.training = await Promise.all(this.dataset.getTrainingSamples().map(async function (sample: RawSample) {
            return that.transformSample(sample);
        }));
        return this.cache.training;
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    async getValidationSamples(): Promise<TensorSample[]> {
        if (this.cache.validation != null)
            return this.cache.validation;

        let that = this;
        this.cache.validation = await Promise.all(this.dataset.getValidationSamples().map(async function (sample: RawSample) {
            return that.transformSample(sample);
        }));
        return this.cache.validation;
    }

    /**
     * Returns all samples from the training portion of the dataset
     */
    async getTestSamples(): Promise<TensorSample[]> {
        if (this.cache.testing != null)
            return this.cache.testing;

        let that = this;
        this.cache.testing = await Promise.all(this.dataset.getTestSamples().map(async function (sample: RawSample) {
            return that.transformSample(sample);
        }));
        return this.cache.testing;
    }
}