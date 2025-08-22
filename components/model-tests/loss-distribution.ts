import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { Dataset, TransformedDataset } from "../../lib/dataset/dataset"
import * as tf from '@tensorflow/tfjs';
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import ApexCharts from "apexcharts";
import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { until } from 'lit-html/directives/until.js';
import { AiWidgetsTest } from '../../widgets/webwriter-test';
setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
setThreadsCount(4);

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

export class LossDistribution extends LitElementWw {
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
    `

    @property()
    accessor model:tf.LayersModel;

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

    async getDiagram() {
        let model = this.model;
        let errors = [];

        for (let i = this.rawDataset.validationEnd; i < this.rawDataset.length(); i++) {
            let sample = await this.tensorDataset.getSample(i);
            tf.tidy(() => {
                let inputs = Object.entries(sample).filter(([s,v]) => model.inputNames.indexOf("in_" + s) != -1).map(([s,v]) => v)
                inputs = inputs.map(i => i.reshape([1 , ...i.shape]))
                let out = model.predict(inputs, {batchSize:1}) as tf.Tensor;
                let diff = sample[model.outputNames[0].replace("out_","")].sub(out);
                let err = diff.abs().sum();
                errors.push(err.arraySync())
            })
            Object.values(sample).forEach(t => t.dispose());
        }
        //errors = errors.filter(v => v < 0.1)

        let min = Math.min(...errors)
        let max = Math.max(...errors)
        let bins = new Array<number>(5);
        let titles = []
        bins.fill(0);
        for (let e of errors) {
            let p = (e - min) / (max - min)
            bins[Math.floor(p * bins.length)] += 1;
        }
        bins.pop(); // Because we always round down the bins
        for (let b = 0; b < bins.length; b++) {
            let p = b / bins.length;
            titles[b] = (p * (max - min) + min).toPrecision(3) + " - " + ((p + 1 / bins.length) * (max - min) + min).toPrecision(3);
        }
        let chartDiv = document.createElement("div");
        let chart = new ApexCharts(chartDiv, {
            series: [{
                name: 'Frequency',
                data: bins
            }],
            chart: {
                id: 'realtime',
                height: 200,
                type: 'bar',
                animations: {
                    enabled: false
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                }
            },
            dataLabels: {
                enabled: false
            },
            title: {
                text: 'Training Loss Spread',
                align: 'left'
            },
            markers: {
                size: 0
            },
            xaxis: {
                type: 'number',
                categories: titles,
            },
            yaxis: {
                min: 0
            },
            legend: {
                show: false
            },
        });
        setTimeout(function() {
            chart.render();
        }, 10)

        return html`${chartDiv}`
    }

    public render(): TemplateResult {
        if (this.model == null)
            return html`<p>Loading model...</p>`

        return html`${until(this.getDiagram(), html`<p>Calculating Loss Distribution...</p>`)}`
    }
}