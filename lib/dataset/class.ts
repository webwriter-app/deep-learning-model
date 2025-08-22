import * as tf from '@tensorflow/tfjs';
import { html, css, TemplateResult, PropertyValues } from "lit"
import { until } from 'lit/directives/until.js';
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput, SlProgressBar } from "@shoelace-style/shoelace"
import { FeatureSettings, FeatureTransformation } from './feature';

/**
* This is the transformation from string values to a class encoding
*/
export default class ClassTransformation extends FeatureTransformation {
    static {
        this.registry.push({name: "Class Encoding", constructor:this});
    }

    /**
    * The constructor runs through the samples and registers the unique classes.
    */
    public constructor(samples: Array<string> | Array<any>, settings: FeatureSettings) {
        super("Class Encoding", samples, settings);

        this.aggrigatedInformation.classes = new Array<string>();
        this.aggrigatedInformation.multiClasses = new Array<string>();

        let hasMulti = false;
        for (let sample of samples) {
            let classes = this.aggrigatedInformation.classes;
            if (classes.indexOf(sample) == -1)
                classes.push(sample);

            if (typeof sample =="object" || (sample.startsWith != null && sample.startsWith("["))) {
                hasMulti = true;
                let multiClasses = this.aggrigatedInformation.multiClasses;

                let sampleClasses = sample;
                if (typeof sample == "string")
                    sampleClasses = JSON.parse(sample);

                sampleClasses.forEach(function(c:string) {
                    if (multiClasses.indexOf(c) == -1)
                        multiClasses.push(c);
                })
            }
        }

        if (!this.settings.type)
            this.settings.type = hasMulti ? "multi-hot" : "one-hot";

        this.aggrigatedInformation.classes.sort();
        this.aggrigatedInformation.multiClasses.sort();
    }

    public size(): [number] {
        if (this.getSetting("type") == "one-hot")
            return [(this.aggrigatedInformation.classes.length as number)];
        if (this.getSetting("type") == "multi-hot")
            return [(this.aggrigatedInformation.multiClasses.length as number)];
    }

    public async transform(value: string | Array<any>): Promise<tf.Tensor1D> {
        if (this.getSetting("type") == "one-hot") {
            let classes = this.aggrigatedInformation.classes;
            let index = classes.indexOf(value);
            if (index == -1)
                return tf.zeros(this.size());

            let tensor = new Array<number>(classes.length);
            tensor.fill(0);
            tensor[index] = 1;
            return tf.tensor(tensor);
        } else if (this.getSetting("type") == "multi-hot") {
            let classes = this.aggrigatedInformation.multiClasses;

            let sampleClasses = value;
            if (typeof value == "string")
                sampleClasses = JSON.parse(value);
            let tensor = new Array<number>(classes.length);
            tensor.fill(0);

            for (let c of sampleClasses) {
                let index = classes.indexOf(c);
                tensor[index] = 1;
            }
            return tf.tensor(tensor);
        }
    }

    public async inverse(tensor: tf.Tensor1D): Promise<string> {
        if (this.getSetting("type") == "one-hot") {
            return tf.tidy(() => {
                let index = tf.argMax(tensor.reshape([1, tensor.shape[0]]), 1).arraySync()[0];
                let clazz = this.aggrigatedInformation.classes[index];
                return clazz;
            })
        } else if (this.getSetting("type") == "multi-hot") {
            let values = tensor.arraySync();
            let outClasses = [];
            for (let i = 0; i < values.length; i++)
                if (values[i] > 0.5) 
                    outClasses.push(this.aggrigatedInformation.multiClasses[i])
            return JSON.stringify(outClasses);
        }
    }

    public getOutputElement(id: string): TemplateResult {
        return html`<class-table id=${id}></class-table>`
    }

    public getInputElement(id: string): TemplateResult {
        return html`<class-input id=${id} classes=${JSON.stringify(this.getClasses())} multi=${this.settings.type == "multi-hot"}></class-input>`;
    }

    public getClasses() : string[]{
        if (this.getSetting("type") == "one-hot")
            return this.aggrigatedInformation.classes;
        if (this.getSetting("type") == "multi-hot")
            return this.aggrigatedInformation.multiClasses;
    }

    public renderPredictionDifference(pred:tf.Tensor1D, label:tf.Tensor1D) {
        return html`${until((async () => {
            let predClass = await this.inverse(pred);
            let labelClass = await this.inverse(label);
            return html`${"Prediction:" + predClass + " ≠ Label:" + labelClass}`
        })(), html`Visualizing Difference...`)}`;
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
            <sl-select label="Type" @sl-change=${typechange} value=${this.settings.type}>
                <sl-option value="one-hot">One Class per Sample</sl-option>
                <sl-option value="multi-hot">Multiple Classes per Sample</sl-option>
            </sl-select>`
    }

    public renderTransformedValue(value: string): TemplateResult {
        return html`${until(
            (async () => {
                let transformed = (await this.transform(value)).arraySync();
                return html`${transformed.join(", ")}`;
            })(), html`Loading...`)}`;
    }
}