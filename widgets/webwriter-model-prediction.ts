import { SlButton, SlButtonGroup, SlIcon, SlIconButton, SlInput, SlOption, SlSelect } from "@shoelace-style/shoelace";
import { LitElementWw } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { msg } from "@lit/localize";
import { customElement, property, query } from "lit/decorators.js";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { AiWidgetsFeatures } from "./webwriter-feature-engineering";
//import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { until } from 'lit-html/directives/until.js';
import { ClassInput } from '../components/inference-fields/class-input';
import { ClassTable } from '../components/inference-fields/class-output';
import { TensorImage } from '../components/inference-fields/image';
import { DrawingCanvas } from '../components/inference-fields/image-input';
import { InputElement, OutputElement } from '../components/inference-fields/inference-interfaces';
import { NumberInput } from '../components/inference-fields/number-input';
import { NumberOutput } from '../components/inference-fields/number-output';
import { AiWidgetsTraining } from './webwriter-model-training';
import LOCALIZE from "../localization/generated";
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
 * A widget to run inference using a trained model and features created in the feature engineering widget.
 */
@customElement("webwriter-model-prediction")
export class AiWidgetsInference extends LitElementWw {
    /** @internal */
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-input":SlInput,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton,
        "ref-select": AiWidgetsReferenceSelect,
        "drawing-canvas": DrawingCanvas,
        "class-table": ClassTable,
        "tensor-image": TensorImage,
        "class-input": ClassInput,
        "number-output": NumberOutput,
        "number-input": NumberInput
    }

    protected localize = LOCALIZE;

    static styles = css`
        :host div[part='options'] {
            display:none;
        }
        :host([contenteditable]) div[part='options'] {
            display:block;
        }
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
        #inputs, #outputs {
            max-width: 50%;
        }
        p {
            margin: 5px 0px;
        }
    `

    /**
     * The id of the feature engineering widget to use as input.
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

    @property({ type: String, attribute: true, reflect: true })
    private accessor selectedModelName: string;

    private model:TF.LayersModel;

    constructor() {
        super();
        let that = this;
        setInterval(function() {
            that.predict();
        }, 200);
    }

    /**
     * Renders the model select field allowing the user to change the model checkpoint that is used for inference.
     */
    private async getModelSelect() {
        let that = this;
        await waitFor(function() {return that.modelSelect != null && that.modelSelect.getRefElement != null && (that.modelSelect.getRefElement() as AiWidgetsTraining).getAvailableModels != null});
        let models = (this.modelSelect.getRefElement() as AiWidgetsTraining).getAvailableModels();
        if (this.model == null)
            setTimeout(function() {
                that.selectedModelChange();
            })
        return html`<sl-select label=${msg("Model version")} id="epoch-select" value=${this.selectedModelName} @sl-change=${this.selectedModelChange}>${models.map(model => html`<sl-option value=${model}>${model}</sl-option>`)}</sl-select>`;
    }

    /** Renders the left input fields which the user can edit and which values are fed into the model periodically. */
    private getFeatureInputs() {
        if (this.model == null)
            return html`<p>${msg("No Model avaiable.")}</p>`;
        let that = this;
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset();
        let elements = [html`<div class="input"><p>🡺 ${msg("Inputs")}</p></div>`];
        for (let input of this.model.inputNames) {
            let featureName = input.replace("in_","");
            let transform = tensorDataset.featureMaps[featureName];
            elements.push(html`<div class="input"><p>${featureName}</p>${transform.getInputElement(input)}</div>`);
        }
        return html`<div id="inputs">${elements}</div>`
    }

    /** Renders the right output fields which are generated by the model output periodically. */
    private getFeatureOutputs() {
        if (this.model == null)
            return html``;
        let that = this;
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset();
        let elements = [html`<div class="output"><p>${msg("Outputs")} 🡺</p></div>`];
        for (let input of this.model.outputNames) {
            let featureName = input.replace("out_","");
            let transform = tensorDataset.featureMaps[featureName];
            elements.push(html`<div class="output"><p>${featureName}</p>${transform.getOutputElement(input)}</div>`);
        }
        return html`<div id="outputs">${elements}</div>`
    }

    public render(): TemplateResult {
        if (this.selectedModelName == null || this.selectedModelName == "")
            this.selectedModelName = "best";

        let that = this;
        setTimeout(function() {
            that.fillWithRandomSample()
        }, 1000);
        return html`<div id="container">
        <div id="top">
        ${until(this.getModelSelect(), html`${msg("Loading models...")}`)}
        <sl-button @click=${this.fillWithRandomSample}>${msg("Show Random Test Sample")}</sl-button>
        </div>
        ${this.getFeatureInputs()}
        ${this.getFeatureOutputs()}
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
        this.model = null;

        let that = this;
        function modelUpdate() {
            that.model = null;
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
        this.requestUpdate()
    }


    private fillWithRandomSample() {
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        this.fillWithSample(Math.floor(Math.random() * (rawDataset.validationEnd - rawDataset.length()) + rawDataset.validationEnd))
    }

    /**
     * Sets the state of the input fields to the value of a sample.
     * @param id The id of the sample in the dataset.
     */
    private async fillWithSample(id:number) {
        if (this.model == null)
            return;
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        let sample = await tensorDataset.getSample(id);
        for (let input of this.model.inputNames) {
            let inElem = this.shadowRoot.getElementById(input) as InputElement;
            let featureName = input.replace("in_","");
            inElem.setTensor(sample[featureName], tensorDataset.featureMaps[featureName]);
        }
    }

    /** Is periodically called and will invoke the input fields values on the model to update the output fields. */
    private async predict() {
        if (this.model == null)
            return;

        let that = this;
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        let inputs = [];
        for (let input of this.model.inputNames) {
            let inElem = this.shadowRoot.getElementById(input) as InputElement;
            let tensor = await inElem.getTensor(tensorDataset.featureMaps[input.replace("in_","")]);
            inputs.push(tensor.reshape([1, ...tensor.shape]))
            tensor.dispose();
        }
        let out = that.model.predict(inputs, {batchSize:1}) as TF.Tensor;
        for (let i = 0; i < this.model.outputNames.length; i++) {
            let output = this.model.outputNames[i];
            let outElem = this.shadowRoot.getElementById(output) as OutputElement;
            await outElem.setTensor(out, tensorDataset.featureMaps[output.replace("out_","")]);
        }
        for (let input of inputs)
            input.dispose();
        out.dispose();
    }
}

