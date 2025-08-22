import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { Dataset, TransformedDataset } from "../lib/dataset/dataset"
import * as tf from '@tensorflow/tfjs';
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import { AiWidgetsReferenceSelect } from "../components/refference-element-select"
import { AiWidgetsFeatures } from "./webwriter-features"
import { AiWidgetsDesigns } from "./webwriter-design";
import ApexCharts from "apexcharts";
//import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { Editor, Layer } from "../lib/layers";
import { DrawingCanvas } from '../components/inference-fields/image-input';
import { AiWidgetsTraining } from './webwriter-training';
import { until } from 'lit-html/directives/until.js';
import { InputElement, OutputElement } from '../components/inference-fields/inference-interfaces';
import { ClassTable } from '../components/inference-fields/class-output';
import { TensorImage } from '../components/inference-fields/image';
import { ClassInput } from '../components/inference-fields/class-input';
import { NumberOutput } from '../components/inference-fields/number-output';
import { NumberInput } from '../components/inference-fields/number-input';
//setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
//setThreadsCount(4);

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

@customElement("webwriter-inference")
export class AiWidgetsInference extends LitElementWw {
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

    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    @query("#feature-select")
    accessor featureSelect: AiWidgetsReferenceSelect;

    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;

    @query("#model-select")
    accessor modelSelect: AiWidgetsReferenceSelect;

    @query("#epoch-select")
    accessor modelName: SlSelect;

    @property({ type: String, attribute: true, reflect: true })
    accessor selectedModelName: string;

    private model:tf.LayersModel;

    constructor() {
        super();
        let that = this;
        setInterval(function() {
            that.predict();
        }, 200);
    }

    async getModelSelect() {
        let that = this;
        await waitFor(function() {return that.modelSelect != null && that.modelSelect.getRefElement != null && (that.modelSelect.getRefElement() as AiWidgetsTraining).getAvailableModels != null});
        let models = Object.entries(await (this.modelSelect.getRefElement() as AiWidgetsTraining).getAvailableModels()).sort((m1, m2) => m1[1].dateSaved.getTime() - m2[1].dateSaved.getTime());
        setTimeout(function() {
            that.selectedModelChange();
        })
        return html`<sl-select label="Model version" id="epoch-select" value=${this.selectedModelName} @sl-change=${this.selectedModelChange}>${models.map(model => html`<sl-option value=${model[0]}>${model[0].replace("indexeddb://","")}</sl-option>`)}</sl-select>`;
    }

    async getFeatureInputs() {
        let that = this;
        await waitFor(function() {return that.model != null});
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset();
        let elements = [html`<div class="input"><p>🡺 Inputs</p></div>`];
        for (let input of this.model.inputNames) {
            let featureName = input.replace("in_","");
            let transform = tensorDataset.featureMaps[featureName];
            elements.push(html`<div class="input"><p>${featureName}</p>${transform.getInputElement(input)}</div>`);
        }
        return html`<div id="inputs">${elements}</div>`
    }

    async getFeatureOutputs() {
        let that = this;
        await waitFor(function() {return that.model != null});
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset();
        let elements = [html`<div class="output"><p>Outputs 🡺</p></div>`];
        for (let input of this.model.outputNames) {
            let featureName = input.replace("out_","");
            let transform = tensorDataset.featureMaps[featureName];
            elements.push(html`<div class="output"><p>${featureName}</p>${transform.getOutputElement(input)}</div>`);
        }
        return html`<div id="outputs">${elements}</div>`
    }

    public render(): TemplateResult {
        if (this.selectedModelName == null || this.selectedModelName == "")
            this.selectedModelName = "indexeddb://best";

        let that = this;
        setTimeout(function() {
            that.fillWithRandomSample()
        }, 1000);
        return html`<div id="container">
        <div id="top">
        ${until(this.getModelSelect(), html`Loading models...`)}
        <sl-button @click=${this.fillWithRandomSample}>Show Random Test Sample</sl-button>
        </div>
        ${until(this.getFeatureInputs(), html`Preparing Inputs...`)}
        ${until(this.getFeatureOutputs(), html`Preparing Outputs...`)}
        </div>
        <div part="options">
            <p>Feature Source</p>
            <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-features" @refchange=${this.featureRefChange}></ref-select>
            <p>Model Source</p>
            <ref-select id="model-select" typeName="Model" elemId=${this.modelWidgetId} elementType="webwriter-training" @refchange=${this.modelRefChange}></ref-select>
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

    private fillWithRandomSample() {
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        this.fillWithSample(Math.floor(Math.random() * (rawDataset.validationEnd - rawDataset.length()) + rawDataset.validationEnd))
    }

    private async fillWithSample(id:number) {
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        let sample = await tensorDataset.getSample(id);
        for (let input of this.model.inputNames) {
            let inElem = this.shadowRoot.getElementById(input) as InputElement;
            let featureName = input.replace("in_","");
            inElem.setTensor(sample[featureName], tensorDataset.featureMaps[featureName]);
        }
    }

    private async predict() {
        let that = this;
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset()
        let inputs = [];
        for (let input of this.model.inputNames) {
            let inElem = this.shadowRoot.getElementById(input) as InputElement;
            let tensor = await inElem.getTensor(tensorDataset.featureMaps[input.replace("in_","")]);
            inputs.push(tensor.reshape([1, ...tensor.shape]))
            tensor.dispose();
        }
        let out = that.model.predict(inputs, {batchSize:1}) as tf.Tensor;
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

