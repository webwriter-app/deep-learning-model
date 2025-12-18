import { SlButton, SlButtonGroup, SlIcon, SlInput, SlOption, SlSelect } from "@shoelace-style/shoelace";
import { LitElementWw } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { msg } from "@lit/localize";
import { customElement, property, query } from "lit/decorators.js";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { AiWidgetsFeatures } from "./webwriter-feature-engineering";
//import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { until } from 'lit-html/directives/until.js';
import { BadSamples } from '../components/model-tests/bad-samples';
import { LossDistribution } from '../components/model-tests/loss-distribution';
import LOCALIZE from "../localization/generated";
import { AiWidgetsTraining } from './webwriter-model-training';
//setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
//setThreadsCount(4);

import type * as TF from "@tensorflow/tfjs";
import getTF from "../lib/tflib";
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

/**
 * A widget that allows evaluating a trained model using various tests.
 */
@customElement("webwriter-model-evaluation")
export class AiWidgetsTest extends LitElementWw {
    /** @internal */
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-input":SlInput,
        "sl-icon": SlIcon,
        "ref-select": AiWidgetsReferenceSelect,
        "loss-dist": LossDistribution,
        "bad-samples": BadSamples
    }

    protected localize = LOCALIZE;

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
        :host div[part='options'] {
            display:none;
        }
        :host([contenteditable]) div[part='options'] {
            display:block;
        }
        #top {
            width: 100%;
            display: flex;
            align-items: flex-end;
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

    /**
     * The id of the feature engineering widget to use as feature source.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    @query("#feature-select")
    private accessor featureSelect: AiWidgetsReferenceSelect;

    /**
     * The id of the model training widget to use as model source.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;

    @query("#model-select")
    private accessor modelSelect: AiWidgetsReferenceSelect;

    @query("#epoch-select")
    private accessor modelName: SlSelect;

    @query("#test-select")
    private accessor testSelect: SlSelect;

    @query("#test-container")
    private accessor testContainer: HTMLDivElement;
    
    private testElem: TemplateResult;

    @property({ type: String, attribute: true, reflect: true })
    private accessor selectedModelName: string;

    private model:TF.LayersModel;

    constructor() {
        super();
        let that = this;
        setTimeout(function() {
            that.requestUpdate();
        }, 3000)
    }

    /**
     * Renders the model select field allowing the user to change the model checkpoint that is used for testing.
     */
    async getModelSelect() {
        let that = this;
        await waitFor(function() {return that.modelSelect != null && that.modelSelect.getRefElement != null && (that.modelSelect.getRefElement() as AiWidgetsTraining).getAvailableModels != null});
        let models = (this.modelSelect.getRefElement() as AiWidgetsTraining).getAvailableModels();
        return html`<sl-select label=${msg("Model version")} id="epoch-select" value=${this.selectedModelName} @sl-change=${this.selectedModelChange}>${models.map(model => html`<sl-option value=${model}>${model}</sl-option>`)}</sl-select>`;
    }

    public render(): TemplateResult {
        if (this.selectedModelName == null || this.selectedModelName == "")
            this.selectedModelName = "best";

        return html`
        ${until(this.getModelSelect(), html`${msg("Loading models...")}`)}
        <sl-select label=${msg("Test / Evaluation")} id="test-select" @sl-change=${this.testChange}>
            <sl-option value="loss-dist">${msg("Loss Distribution")}</sl-option>
            <sl-option value="bad-samples">${msg("Worst Samples")}</sl-option>
        </sl-select>
        <div id="test-container">
            ${this.testElem}
        </div>
        <div part="options">
            <p>${msg("Feature Source")}</p>
            <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-feature-engineering" @refchange=${this.featureRefChange} ownerId=${this.id}></ref-select>
            <p>${msg("Model Source")}</p>
            <ref-select id="model-select" typeName="Model" elemId=${this.modelWidgetId} elementType="webwriter-model-training" @refchange=${this.modelRefChange} ownerId=${this.id}></ref-select>
        </div>`
    }

    private modelRefChange(e:CustomEvent) {
        this.modelWidgetId = e.detail.id;

        let that = this;
        function modelUpdate() {
            that.requestUpdate();
        }

        if (e.detail.lastRef != null)
            e.detail.lastRef.removeEventListener("finished", modelUpdate);
        this.modelSelect.getRefElement().addEventListener("finished", modelUpdate);
    }

    private featureRefChange(e:CustomEvent) {
        this.featureWidgetId = e.detail.id;

        let that = this;
        function featuresUpdate() {
            that.requestUpdate();
        }

        if (e.detail.lastRef != null)
            e.detail.lastRef.removeEventListener("change", featuresUpdate);
        this.modelSelect.getRefElement().addEventListener("change", featuresUpdate);
    }

    private async selectedModelChange() {
        let name = this.modelName.value as string;
        this.selectedModelName = name;
        try {
            this.model.dispose();
        } catch(e) {}
        this.model = await (this.modelSelect.getRefElement() as AiWidgetsTraining).getModel(name);
    }

    /** Renders the test results when the test changes. */
    private async testChange() {
        let test = this.testSelect.value as string;
        let model = await (this.modelSelect.getRefElement() as AiWidgetsTraining).getModel(this.selectedModelName);
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        if (test == "loss-dist") {
            this.testElem = html`<loss-dist .model=${model} .rawDataset=${rawDataset} .tensorDataset=${tensorDataset}></loss-dist>`
        }
        if (test == "bad-samples") {
            this.testElem = html`<bad-samples .model=${model} .rawDataset=${rawDataset} .tensorDataset=${tensorDataset}></bad-samples>`
        }
        this.requestUpdate();
    }
}