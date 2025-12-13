import { SlSelect } from '@shoelace-style/shoelace';
import { html, TemplateResult } from "lit";
import { msg, str } from "@lit/localize";
import { until } from 'lit/directives/until.js';
import { FeatureSettings, FeatureTransformation, NonEmptyArray } from './feature';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

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

    public async transform(value: string): Promise<TF.Tensor1D> {
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

    public async inverse(tensor: TF.Tensor): Promise<string> {
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

    public renderPredictionDifference(pred:TF.Tensor1D, label:TF.Tensor1D) {
        return html`${until((async () => {
            let predValue = await this.inverse(pred);
            let labelValue = await this.inverse(label);
            return html`${msg(str`Prediction: ${predValue} - Label: ${labelValue} = Delta: ${parseFloat(predValue) - parseFloat(labelValue)}`)}`;
        })(), html`${msg("Visualizing Difference...")}`)}`;
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
            <sl-select label=${msg("Value Scale")} @sl-change=${typechange} value=${this.settings.type}>
                <sl-option value="linear">${msg("Linear")}</sl-option>
                <sl-option value="exp">${msg("Exponential")}</sl-option>
                <sl-option value="quad">${msg("Quadratic")}</sl-option>
            </sl-select>`
    }

    public renderTransformedValue(value: string): TemplateResult {
        return html`${until(
            (async () => { return (await this.transform(value)).arraySync()[0].toFixed(3) })(), html`${msg("Loading")}`)}`;
    }
}