import { msg } from "@lit/localize";
import { SlButton, SlButtonGroup, SlIcon, SlIconButton, SlInput, SlOption, SlSelect } from "@shoelace-style/shoelace";
import { LitElementWw } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { until } from 'lit-html/directives/until.js';
import { property } from "lit/decorators.js";
import { Dataset, TransformedDataset } from "../../lib/dataset/dataset";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

async function waitFor(condition: Function, interval = 10) {
    if (condition())
        return;
    return new Promise(async function(res, rej) {
      let inter = setInterval(function() {
        if (condition()) {
          clearInterval(inter)
          res(null);
        }
      }, interval)
    });
}

export class BadSamples extends LitElementWw {
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-input":SlInput,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton,
    }

    static styles = css`
        #container {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-content: flex-start;
            justify-content: center;
            align-items: flex-start;
            gap: 5px;
        }
        #container *  {
            flex-grow: 1;
        }
        #top {
            width: 100%;
            display: flex;
        }
        .input, .output {
            padding: 5px 10px;
            position: relative;
            border: 1px solid lightgrey;
            border-radius: 5px;
        }
        .input > *, .output > * {
            width: 100%;
        }
        .input > p, .output > p {
            margin: 0px;
            font-size: 16px;
        }
        table {
            width:100%;
        }
        table td {
            padding: 0px 10px;
        }
    `

    @property()
    accessor model:TF.LayersModel;

    @property()
    accessor rawDataset: Dataset;

    @property()
    accessor tensorDataset: TransformedDataset;

    constructor() {
        super();
        let that = this;
        setTimeout(function() {
            that.requestUpdate();
        }, 1000)
    }

    async getBadSamples() {
        let model = this.model;
        let errors = [];

        for (let i = this.rawDataset.validationEnd; i < this.rawDataset.length(); i++) {
            let sample = await this.tensorDataset.getSample(i);
            tf.tidy(() => {
                let inputs = Object.entries(sample).filter(([s,v]) => model.inputNames.indexOf("in_" + s) != -1).map(([s,v]) => v)
                inputs = inputs.map(i => i.reshape([1 , ...i.shape]))
                let out = model.predict(inputs, {batchSize:1});
                let err;
                if (out instanceof Array) {

                } else {
                    out = out.squeeze();
                    tf.keep(out);
                    let diff = sample[model.outputNames[0].replace("out_","")].sub(out);
                    err = diff.abs().sum();
                }
                errors.push({sample: i, loss:err.arraySync(), pred:out})
            })
            Object.values(sample).forEach(t => t.dispose());
        }

        let sorted = errors.sort((e1 , e2) => e2.loss - e1.loss).slice(0,6);
        let that = this;
        let output = [];
        for (let err of sorted) {
            let tData = []
            for (let inName of model.inputNames) {
                let featureName = inName.replace("in_","");
                let sample = that.rawDataset.getSample(err.sample)
                let features = that.tensorDataset.featureMaps;
                let featureElement = features[featureName].renderTransformedValue(sample[featureName]);
                tData.push(html`<td>${featureElement}</td>`)
            }
            for (let outName of model.outputNames) {
                let featureName = outName.replace("out_","");
                let sample = that.rawDataset.getSample(err.sample)
                let features = that.tensorDataset.featureMaps;
                let label = await features[featureName].transform(sample[featureName]);
                let featureElement = features[featureName].renderPredictionDifference(err.pred, label);
                //label.dispose();
                tData.push(html`<td>${featureElement}</td>`)
            }

            output.push(html`<tr>${tData}<td>${err.loss.toFixed(3)}</td></tr>`);
        };
        let names = [...model.inputNames.map(name => name.replace("in_","")), ...model.outputNames.map(name => name.replace("out_","")), "Absolute Difference"]

        return html`<table><thead><tr>${names.map(n => html`<td>${n}</td>`)}</tr></thead><tbody>${output}</tbody></table>`
    }

    public render(): TemplateResult {
        if (this.model == null)
            return html`<p>${msg("Loading model...")}</p>`

        return html`${until(this.getBadSamples(), html`<p>${msg("Calculating Loss For Samples...")}</p>`)}`
    }
}