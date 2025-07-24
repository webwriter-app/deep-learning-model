import { SlInput, SlSelect } from '@shoelace-style/shoelace';
import * as tf from '@tensorflow/tfjs';
import { html, css, TemplateResult, PropertyValues } from "lit"
import { until } from 'lit/directives/until.js';
import { FeatureSettings, FeatureTransformation, NonEmptyArray } from './feature';

/**
* This is the transformation from string values to a class encoding
*/
export default class LinearTransformation extends FeatureTransformation {
    static {
        this.registry.push({name: "Number Encoding", constructor:this});
    }

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
        if (typeof value == "string")
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

    public async inverse(tensor: tf.Tensor): Promise<string> {
        let min = this.aggrigatedInformation.min;
        let max = this.aggrigatedInformation.max;

        let base = tensor.arraySync() as number;
        if (this.settings.type == "exp")
            base = (Math.exp(base) - 1) / (Math.E - 1);
        if (this.settings.type == "quad")
            base = Math.pow(base, 2);

        return String((base * (max - min) + min))
    }

    public getInputElement(id: string): TemplateResult {
        return html`<number-input id=${id}></number-input>`
    }
    public getOutputElement(id: string): TemplateResult {
        return html`<number-output id=${id}></number-output>`
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