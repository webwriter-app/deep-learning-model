import type { MsgFn } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { LitElementWw } from "@webwriter/lit";
import { localizer } from "@webwriter/lit/localize";
import { css, html, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { localeOptions } from "../../localization/locale-options";
import { ClassInput } from "../components/inference-fields/class-input";
import { ClassTable } from "../components/inference-fields/class-output";
import { TensorImage } from "../components/inference-fields/image";
import { DrawingCanvas } from "../components/inference-fields/image-input";
import { InputElement, OutputElement } from "../components/inference-fields/inference-interfaces";
import { NumberInput } from "../components/inference-fields/number-input";
import { NumberOutput } from "../components/inference-fields/number-output";
import { hostStyles } from "../components/host.styles";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { WebwriterFeatureEngineering } from "./webwriter-feature-engineering";
import { WebwriterModelTraining } from "./webwriter-model-training";

import type * as TF from "@tensorflow/tfjs";

type Labelled = { msg: MsgFn };

async function waitFor(condition: () => unknown, interval = 10) {
    if (condition())
        return;
    return new Promise<void>((res) => {
      let inter = setInterval(function() {
        if (condition()) {
          clearInterval(inter)
          res();
        }
      }, interval)
    });
}

/**
 * A widget to run inference using a trained model and features created in the feature engineering widget.
 *
 * The drawing area takes pen, touch and mouse. "Show Random Test Sample" fills the inputs from the test data without a pointer.
 *
 * @part inputs - The input fields of the model.
 * @part outputs - The predicted outputs of the model.
 */
@customElement("webwriter-model-prediction")
export class WebwriterModelPrediction extends LitElementWw {
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

    static styles = [hostStyles, css`
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
        #inputs, #outputs {
            min-width: min(100%, 14rem);
        }
        @container (max-width: 520px) {
            #top {
                flex-wrap: wrap;
                gap: 5px;
            }
            #top > * {
                flex: 1 1 100%;
            }
        }
        @media print {
            #top, #test-select {
                display: none;
            }
            .input, .output {
                break-inside: avoid;
            }
        }
    `]

    static options = {
        featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")},
        modelWidgetId: {type: "reference" as const, selector: "webwriter-model-training", label: (widget: Labelled) => widget.msg("Model source")},
    }

    readonly localize = localizer(this, localeOptions);
    public readonly msg = this.localize.msg;

    /**
     * The id of the feature engineering widget to use as input.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    /**
     * The id of the model training widget to use as model source.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;

    @property({ type: String, attribute: true, reflect: true })
    private accessor selectedModelName: string;

    @query("#feature-select")
    private accessor featureSelect: AiWidgetsReferenceSelect;

    @query("#model-select")
    private accessor modelSelect: AiWidgetsReferenceSelect;

    @query("#epoch-select")
    private accessor modelName: SlSelect;

    private model: TF.LayersModel | null = null;
    private predictionInterval?: ReturnType<typeof setInterval>;

    private predicting = false;

    connectedCallback() {
        super.connectedCallback();
        // Started here (not in the constructor) so that a re-inserted widget predicts again.
        this.predictionInterval = setInterval(() => this.predict(), 200);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this.predictionInterval);
    }

    private fillWithRandomSample() {
        if (!this.featureSelect || !this.featureSelect.getRefElement())
            return;
        let {rawDataset} = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset()
        if (!rawDataset)
            return;
        this.fillWithSample(Math.floor(Math.random() * (rawDataset.validationEnd - rawDataset.length()) + rawDataset.validationEnd))
    }

    /**
     * Sets the state of the input fields to the value of a sample.
     * @param id The id of the sample in the dataset.
     */
    private async fillWithSample(id:number) {
        if (this.model == null || !this.featureSelect || !this.featureSelect.getRefElement())
            return;
        let {tensorDataset} = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset()
        if (!tensorDataset)
            return;
        let sample = await tensorDataset.getSample(id);
        for (let input of this.model.inputNames) {
            let inElem = this.shadowRoot!.getElementById(input) as InputElement;
            let featureName = input.replace("in_","");
            inElem.setTensor(sample[featureName], tensorDataset.featureMaps[featureName]);
        }
    }

    /** Is periodically called and will invoke the input fields values on the model to update the output fields. */
    private async predict() {
        if (this.predicting) return;
        this.predicting = true;
        try {
            await this.runPrediction();
        } finally {
            this.predicting = false;
        }
    }

    private async runPrediction() {
        if (this.model == null || !this.featureSelect || !this.featureSelect.getRefElement())
            return;

        let {tensorDataset} = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset()
        if (!tensorDataset)
            return;
        let inputs: TF.Tensor[] = [];
        for (let input of this.model.inputNames) {
            let inElem = this.shadowRoot!.getElementById(input) as InputElement;
            let tensor = await inElem.getTensor(tensorDataset.featureMaps[input.replace("in_","")]);
            inputs.push(tensor.reshape([1, ...tensor.shape]))
            tensor.dispose();
        }
        let out = this.model.predict(inputs, {batchSize:1}) as TF.Tensor;
        for (let i = 0; i < this.model.outputNames.length; i++) {
            let output = this.model.outputNames[i];
            let outElem = this.shadowRoot!.getElementById(output) as OutputElement;
            await outElem.setTensor(out, tensorDataset.featureMaps[output.replace("out_","")]);
        }
        for (let input of inputs)
            input.dispose();
        out.dispose();
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
        this.modelSelect.getRefElement()?.addEventListener("finished", modelUpdate);
    }

    private featureRefChange(e:CustomEvent) {
        this.featureWidgetId = e.detail.id;

        let that = this;
        function featuresUpdate() {
            that.requestUpdate();
        }

        if (e.detail.lastRef != null)
            e.detail.lastRef.removeEventListener("change", featuresUpdate);
        this.featureSelect.getRefElement()?.addEventListener("change", featuresUpdate);
    }

    private async selectedModelChange() {
        let name = this.modelName.value as string;
        this.selectedModelName = name;
        try {
            this.model?.dispose();
        } catch(e) {}
        this.model = await (this.modelSelect.getRefElement() as WebwriterModelTraining).getModel(name);
        this.requestUpdate()
    }

    /**
     * Renders the model select field allowing the user to change the model checkpoint that is used for inference.
     */
    private async getModelSelect() {
        let that = this;
        await waitFor(function() {return that.modelSelect != null && that.modelSelect.getRefElement != null && (that.modelSelect.getRefElement() as WebwriterModelTraining)?.getAvailableModels != null});
        let models = (this.modelSelect.getRefElement() as WebwriterModelTraining).getAvailableModels();
        if (this.model == null)
            setTimeout(function() {
                that.selectedModelChange();
            })
        return html`<sl-select label=${this.msg("Model version")} id="epoch-select" value=${this.selectedModelName} @sl-change=${this.selectedModelChange}>${models.map(model => html`<sl-option value=${model}>${model}</sl-option>`)}</sl-select>`;
    }

    /** Renders the left input fields which the user can edit and which values are fed into the model periodically. */
    private getFeatureInputs() {
        if (this.model == null)
            return html`<p>${this.msg("No Model avaiable.")}</p>`;
        let {tensorDataset} = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset();
        if (!tensorDataset)
            return html``;
        let elements = [html`<div class="input"><p>🡺 ${this.msg("Inputs")}</p></div>`];
        for (let input of this.model.inputNames) {
            let featureName = input.replace("in_","");
            let transform = tensorDataset.featureMaps[featureName];
            elements.push(html`<div class="input"><p>${featureName}</p>${transform.getInputElement(input)}</div>`);
        }
        return html`<div id="inputs" part="inputs">${elements}</div>`
    }

    /** Renders the right output fields which are generated by the model output periodically. */
    private getFeatureOutputs() {
        if (this.model == null)
            return html``;
        let {tensorDataset} = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset();
        if (!tensorDataset)
            return html``;
        let elements = [html`<div class="output"><p>${this.msg("Outputs")} 🡺</p></div>`];
        for (let input of this.model.outputNames) {
            let featureName = input.replace("out_","");
            let transform = tensorDataset.featureMaps[featureName];
            elements.push(html`<div class="output"><p>${featureName}</p>${transform.getOutputElement(input)}</div>`);
        }
        return html`<div id="outputs" part="outputs">${elements}</div>`
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
        ${until(this.getModelSelect(), html`${this.msg("Loading models...")}`)}
        <sl-button @click=${this.fillWithRandomSample}>${this.msg("Show Random Test Sample")}</sl-button>
        </div>
        ${this.getFeatureInputs()}
        ${this.getFeatureOutputs()}
        </div>
        <div hidden>
            <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-feature-engineering" @refchange=${this.featureRefChange} ownerId=${this.id}></ref-select>
            <ref-select id="model-select" typeName="Model" elemId=${this.modelWidgetId} elementType="webwriter-model-training" @refchange=${this.modelRefChange} ownerId=${this.id}></ref-select>
        </div>`
    }
}
