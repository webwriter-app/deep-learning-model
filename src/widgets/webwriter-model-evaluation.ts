import type { MsgFn } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { LitElementWw } from "@webwriter/lit";
import { localizer } from "@webwriter/lit/localize";
import { css, html, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { localeOptions } from "../../localization/locale-options";
import { BadSamples } from "../components/model-tests/bad-samples";
import { LossDistribution } from "../components/model-tests/loss-distribution";
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
 * A widget that allows evaluating a trained model using various tests.
 *
 * @part test - The result of the selected test.
 */
@customElement("webwriter-model-evaluation")
export class WebwriterModelEvaluation extends LitElementWw {
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
        #test-select, #epoch-select {
            max-width: 100%;
        }
        @media print {
            #test-select, #epoch-select {
                display: none;
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
     * The id of the feature engineering widget to use as feature source.
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

    @query("#test-select")
    private accessor testSelect: SlSelect;

    private testElem: TemplateResult;

    private model: TF.LayersModel | null = null;

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
        await waitFor(function() {return that.modelSelect != null && that.modelSelect.getRefElement != null && (that.modelSelect.getRefElement() as WebwriterModelTraining)?.getAvailableModels != null});
        let models = (this.modelSelect.getRefElement() as WebwriterModelTraining).getAvailableModels();
        return html`<sl-select label=${this.msg("Model version")} id="epoch-select" value=${this.selectedModelName} @sl-change=${this.selectedModelChange}>${models.map(model => html`<sl-option value=${model}>${model}</sl-option>`)}</sl-select>`;
    }

    private modelRefChange(e:CustomEvent) {
        this.modelWidgetId = e.detail.id;

        let that = this;
        function modelUpdate() {
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
    }

    /** Renders the test results when the test changes. */
    private async testChange() {
        let test = this.testSelect.value as string;
        let model = await (this.modelSelect.getRefElement() as WebwriterModelTraining).getModel(this.selectedModelName);
        let {rawDataset, tensorDataset} = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset()
        if (test == "loss-dist") {
            this.testElem = html`<loss-dist .model=${model} .rawDataset=${rawDataset} .tensorDataset=${tensorDataset}></loss-dist>`
        }
        if (test == "bad-samples") {
            this.testElem = html`<bad-samples .model=${model} .rawDataset=${rawDataset} .tensorDataset=${tensorDataset}></bad-samples>`
        }
        this.requestUpdate();
    }

    public render(): TemplateResult {
        if (this.selectedModelName == null || this.selectedModelName == "")
            this.selectedModelName = "best";

        return html`
        ${until(this.getModelSelect(), html`${this.msg("Loading models...")}`)}
        <sl-select label=${this.msg("Test / Evaluation")} id="test-select" @sl-change=${this.testChange}>
            <sl-option value="loss-dist">${this.msg("Loss Distribution")}</sl-option>
            <sl-option value="bad-samples">${this.msg("Worst Samples")}</sl-option>
        </sl-select>
        <div id="test-container" part="test">
            ${this.testElem}
        </div>
        <div hidden>
            <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-feature-engineering" @refchange=${this.featureRefChange} ownerId=${this.id}></ref-select>
            <ref-select id="model-select" typeName="Model" elemId=${this.modelWidgetId} elementType="webwriter-model-training" @refchange=${this.modelRefChange} ownerId=${this.id}></ref-select>
        </div>`
    }
}
