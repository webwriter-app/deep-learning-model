import { widgetMsg } from "@webwriter/lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { LitElementWw } from "@webwriter/lit";
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Title, Tooltip } from "chart.js";
import { css, html, TemplateResult } from "lit";
import { until } from 'lit/directives/until.js';
import { property } from "lit/decorators.js";
import { Dataset, TransformedDataset } from "../../model/dataset/dataset";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../model/tflib";
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip);

const tf = await getTF();

export class LossDistribution extends LitElementWw {
    private readonly msg = widgetMsg(this);
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

    async getDiagram() {
        let model = this.model;
        let errors: number[] = [];

        for (let i = this.rawDataset.validationEnd; i < this.rawDataset.length(); i++) {
            let sample = await this.tensorDataset.getSample(i);
            tf.tidy(() => {
                let inputs = Object.entries(sample).filter(([s,v]) => model.inputNames.indexOf("in_" + s) != -1).map(([s,v]) => v)
                inputs = inputs.map(i => i.reshape([1 , ...i.shape]))
                let out = model.predict(inputs, {batchSize:1}) as TF.Tensor;
                let diff = sample[model.outputNames[0].replace("out_","")].sub(out);
                let err = diff.abs().sum();
                errors.push(err.arraySync() as number)
            })
            Object.values(sample).forEach(t => t.dispose());
        }

        let min = Math.min(...errors)
        let max = Math.max(...errors)
        let bins = new Array<number>(5);
        let titles: string[] = []
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
        let canvas = document.createElement("canvas");
        let chartDiv = document.createElement("div");
        chartDiv.style.height = "200px";
        chartDiv.append(canvas);
        new Chart(canvas, {
            type: "bar",
            data: {
                labels: titles,
                datasets: [{ label: "Frequency", data: bins, backgroundColor: "#008ffb" }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: "Training Loss Spread", align: "start" },
                },
                scales: { y: { min: 0 } },
            },
        });

        return html`${chartDiv}`
    }

    public render(): TemplateResult {
        if (this.model == null)
            return html`<p>${this.msg("Loading model...")}</p>`

        return html`${until(this.getDiagram(), html`<p>${this.msg("Calculating Loss Distribution...")}</p>`)}`
    }
}