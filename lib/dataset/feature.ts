import { TemplateResult } from "lit/html.js";
import * as tf from '@tensorflow/tfjs';

export type NonEmptyArray<T> = [T, ...T[]];
export type FeatureSettings = Record<string, any> | null;
type Constructor<T> = new (...args: any[]) => T;

type FeatureTransformationRegistryEntry = {
    name: string,
    constructor: Constructor<FeatureTransformation>
}

/**
 * Returns the available feature transformations registered by the classes
 */
export function getFeatureTransformations(): Array<FeatureTransformationRegistryEntry> {
    return FeatureTransformation.registry;
}

/**
 * Returns the available feature transformations registered by the classes
 */
export function getFeatureTransformation(name: string): FeatureTransformationRegistryEntry {
    return FeatureTransformation.registry.find(e => e.name == name);
}

/**
* This class describes a transformation function from a column in the dataset from string values to tensors
*/
export abstract class FeatureTransformation {
    static registry: FeatureTransformationRegistryEntry[] = [];

    /**
    * The information gathered from one run through all samples. This could be the max, avg or the list of unique classes.
    */
    public aggrigatedInformation: Record<string, any> = {};
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
     * Will turn a tensor back into the original string
     * (Note: Some transformations are not lossless or inversable and some approximation may occur on the inverse)
     * @param tensor The tensor to turn into a string
     */
    public abstract inverse(tensor: tf.Tensor): Promise<string>;

    /**
     * Returns an interactive element with a getTensor() method, that will be used to input custom data for inference. It is important to set the id of the element.
     */
    public abstract getInputElement(id:string): TemplateResult;

    /**
     * Returns an element with a setTensor() method, that will be used to display the output after inference. It is important to set the id of the element.
     */
    public abstract getOutputElement(id:string): TemplateResult;

    /**
     * Returns the element that will be displayed and changes the settings of the transformation
     */
    public abstract getSettingElement(changeCallback: (settings: FeatureSettings) => void): TemplateResult;

    /**
     * Returns an html element that will be displayed. Can be a simple text or an image etc.
     */
    public abstract renderTransformedValue(value: string): TemplateResult;

    /**
     * Returns an html element that will be displayed. Can be a simple text or an image etc.
     */
    public abstract renderPredictionDifference(pred: tf.Tensor, label: tf.Tensor): TemplateResult;

    public getSetting(name: string) {
        return this.settings[name];
    }
}