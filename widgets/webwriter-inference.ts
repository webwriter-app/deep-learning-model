import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import * as tf from '@tensorflow/tfjs';
import { setupLayerRenderer } from "../lib/types/layers"
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import { AiWidgetsReferenceSelect } from "../components/refference-element-select"
import { AiWidgetsFeatures } from "./webwriter-features"
import { AiWidgetsDesigns } from "./webwriter-design";
import ApexCharts from "apexcharts";
import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { Editor, Layer } from "../lib/layers";
import { GrayscaleDrawing } from '../components/image-input';
setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
setThreadsCount(4);

@customElement("webwriter-training")
export class AiWidgetsTraining extends LitElementWw {
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-input":SlInput,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton,
        "ref-select": AiWidgetsReferenceSelect,
        "grayscale-drawing": GrayscaleDrawing
    }

    static styles = css``

    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;
    private featureSelect = document.createElement("ref-select") as AiWidgetsReferenceSelect;

    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;
    private modelSelect = document.createElement("ref-select") as AiWidgetsReferenceSelect;

    constructor() {
        super();
        let that = this;
        setTimeout(function () {
            that.featureSelect.elementType = "webwriter-features";
            that.featureSelect.typeName = "Features";
            that.featureSelect.elemId = that.featureWidgetId;
            that.featureSelect.addEventListener("refchange", function (e: CustomEvent) {
                that.featureWidgetId = e.detail.id;
            })
            that.featureSelect.requestUpdate();

            that.modelSelect.elementType = "webwriter-training";
            that.modelSelect.typeName = "Training";
            that.modelSelect.elemId = that.modelWidgetId;
            that.modelSelect.addEventListener("refchange", function (e: CustomEvent) {
                that.modelWidgetId = e.detail.id;
            })
        }, 0)
    }

    public render(): TemplateResult {
        return html``
    }
}
