import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { ModelEditor } from "../components/model-editor"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import * as tf from '@tensorflow/tfjs';
import { setupLayerRenderer } from "../lib/types/layers"
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton } from "@shoelace-style/shoelace"
import { AiWidgetsReferenceSelect } from "../components/refference-element-select"
import { AiWidgetsFeatures } from "./webwriter-features"



@customElement("webwriter-design")
export class AiWidgetsDesigns extends LitElementWw {
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "model-editor": ModelEditor,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton,
        "ref-select": AiWidgetsReferenceSelect
    }

    static styles = css`
    :host {
      min-height: 200px;
      display:block;
      font-size: 0.9rem;
    }
    #stats {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-items: center;
        gap: 0px 20px;
        margin-bottom: 10px;
    }
    
    #stats p {
        margin: 0px;
    }
    #add {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: center;
        align-content: flex-end;
        gap: 5px 15px;
    }
    .group {
        padding-top: 18px;
        position:relative;
    }
    .group p {
        position:absolute;
        margin:0px;
        font-size: 12px;
        top: 0px;
    }
    #controls {
        position:absolute;
        right: 5px;
        top: 5px;
        z-index: 10;
    }`

    private _suppressNextUpdate = false;
    protected shouldUpdate(changedProps: Map<string, unknown>): boolean {
        if (this._suppressNextUpdate) {
            this._suppressNextUpdate = false;
            return false; // Cancel the update
        }
        return true;
    }

    @property({ type: String, attribute: true, reflect: true })
    accessor state: string;

    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    private refSelect = document.createElement("ref-select") as AiWidgetsReferenceSelect;

    constructor() {
        super();
        let that = this;
        function featureChange(name, data) {
            let state = that.currentCanvas.controler.export();
            that.state = JSON.stringify(state);
            that.currentCanvas.setFields(data.tensorDataset);
            that.currentCanvas.setState(state);
        }
        setTimeout(function () {
            that.refSelect["element-type"] = "webwriter-features";
            that.refSelect.elemId = that.featureWidgetId;
            that.refSelect.addEventListener("refchange", function (e: CustomEvent) {
                that.featureWidgetId = e.detail.id;
            })
        }, 0)

        setInterval(function () {
            let nodes = that.currentCanvas.controler.getNumberOfOperations();
            that.shadowRoot.getElementById("numberNodes").innerText = String(nodes);

            let params = that.currentCanvas.controler.getNumberOfParameters();
            that.shadowRoot.getElementById("params").innerText = String(params);
        }, 100);
    }

    public options: Record<string, OptionDeclaration> = {}

    private currentCanvas: ModelEditor;

    public render(): TemplateResult {
        let that = this;
        console.log("render");
        setTimeout(function () {
            if (that.currentCanvas)
                return;
            let canvas = new ModelEditor();
            that.currentCanvas = canvas;
            that.currentCanvas.onmodelchange = function () {
                that.state = JSON.stringify(that.currentCanvas.controler.export())
            }
            that.currentCanvas.setFields((that.refSelect.getRefElement() as AiWidgetsFeatures).getDataset().tensorDataset);
            if (that.state)
                that.currentCanvas.setState(JSON.parse(that.state));
            that.shadowRoot.prepend(canvas);
        }, 1000);
        return html`
        <div id="stats">
            <p>Number of Operation: <span id="numberNodes"></span></p>
            <p>Total Parameters: <span id="params"></span></p>
        </div>
    <div id="add">
        <div class="group">
            <p>I/O</p>
            <sl-button-group>
                <sl-button @click=${() => this.addLayer("InputLayer")}>Input</sl-button>
                <sl-button @click=${() => this.addLayer("MultiInputLayer")}>Multi-Input</sl-button>
                <sl-button @click=${() => this.addLayer("AccessPoint")}>Access Point</sl-button>
                <sl-button @click=${() => this.addLayer("OutputLayer")}>Output</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Deep Layers</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("FCLLayer")}>Linear</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Misc</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("ActivationLayer")}>Activation</sl-button>
            <sl-button @click=${() => this.addLayer("ProbabalisticLayer")}>Probabalistic</sl-button>
            <sl-button @click=${() => this.addLayer("DropoutLayer")}>Dropout</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Shape</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("FlattenLayer")}>Flatten</sl-button>
            <sl-button @click=${() => this.addLayer("ConcatLayer")}>Concatination</sl-button>
            <sl-button @click=${() => this.addLayer("DeConcatLayer")}>DeConcatination Layer</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Combination</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("AddLayer")}>Add Layer</sl-button>
            </sl-button-group>
        </div>
    </div>
    <div id="controls">
        <sl-button @click=${() => this.zoomReset()}>reset</sl-button>
        <sl-button @click=${() => this.zoomIn()}>+</sl-button>
        <sl-button @click=${() => this.zoomOut()}>-</sl-button>
    </div>
    <div part="options">
        <p>Feature Source</p>
        ${this.refSelect}
      </div>
    `
    }
    public addLayer(type) {
        let dataset = (this.refSelect.getRefElement() as AiWidgetsFeatures).getDataset().tensorDataset;
        let layer = new this.currentCanvas.controler[type](dataset);

    }
    public zoomIn() {
        this.currentCanvas.controler.editor.zoom *= 1.1;
        this.currentCanvas.controler.editor.zoom_refresh();
    }
    public zoomOut() {
        this.currentCanvas.controler.editor.zoom /= 1.1;
        this.currentCanvas.controler.editor.zoom_refresh();
    }
    public zoomReset() {
        this.currentCanvas.controler.editor.zoom = 1;
        let pos = this.currentCanvas.controler.getAveragePosition();
        this.currentCanvas.controler.editor.canvas_x = -pos.x + this.currentCanvas.controler.editor.precanvas.clientWidth / 2;
        this.currentCanvas.controler.editor.canvas_y = -pos.y + this.currentCanvas.controler.editor.precanvas.clientHeight / 2;
        this.currentCanvas.controler.editor.zoom_refresh();
    }
}