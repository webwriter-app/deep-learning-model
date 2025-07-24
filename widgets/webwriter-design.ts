import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { ModelEditor } from "../components/model-editor"
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
    #add > * {
        flex-grow:1;
    }
    #add * > *{
        width: 100%;
    }
    .group {
        padding-top: 18px;
        position:relative;
    }
    .group p {
        position:absolute;
        margin:0px;
        font-size: 15px;
        top: -2px;
    }
    #controls {
        position:absolute;
        right: 5px;
        top: 5px;
        z-index: 10;
    }`

    @property({ type: String, attribute: true, reflect: true })
    accessor state: string;

    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    @query("#feature-select")
    accessor refSelect:AiWidgetsReferenceSelect;

    constructor() {
        super();
        let that = this;

        setInterval(function () {
            let nodes = that.currentCanvas.controler.getNumberOfOperations();
            that.shadowRoot.getElementById("numberNodes").innerText = String(nodes);

            let params = that.currentCanvas.controler.getNumberOfParameters();
            that.shadowRoot.getElementById("params").innerText = String(params);
        }, 100);
    }

    private _handleRefChange(e:CustomEvent) {
        let that = this;
        let featuresElem = that.refSelect.getRefElement() as AiWidgetsFeatures;
        let datasetChangeListener = function () {
            that.currentCanvas.setFields(featuresElem.getDataset().tensorDataset)
        }

        if (e.detail.lastRef != null)
            e.detail.lastRef.removeEventListener("change", datasetChangeListener);

        that.featureWidgetId = e.detail.id;
        that.requestUpdate();
        featuresElem = (that.refSelect.getRefElement() as AiWidgetsFeatures)
        featuresElem.addEventListener("change", datasetChangeListener);
        if (featuresElem.isReady && featuresElem.isReady())
            datasetChangeListener();

        if (this.state && this.state != "")
            this.currentCanvas.setState(JSON.parse(this.state));
    }

    public options: Record<string, OptionDeclaration> = {}

    @query("#model-editor")
    accessor currentCanvas: ModelEditor;

    private _editorChange(e:CustomEvent) {
        this.state = JSON.stringify(e.detail.state)
    }

    public render(): TemplateResult {
        return html`
        <model-editor id="model-editor" @modelchange=${this._editorChange}></model-editor>
        <div id="stats">
            <p>Number of Operation: <span id="numberNodes"></span></p>
            <p>Total Parameters: <span id="params"></span></p>
        </div>
    <div id="add">
        <div class="group">
            <p>I/O</p>
            <sl-button-group>
                <sl-button @click=${() => this.addLayer("input")}>Input</sl-button>
                <sl-button @click=${() => this.addLayer("output")}>Output</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Deep Layers</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("fcl")}>Linear</sl-button>
            <sl-button @click=${() => this.addLayer("conv")}>Convolution</sl-button>
            <sl-button @click=${() => this.addLayer("transposeconv")}>Transpose Convolution</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Misc</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("activation")}>Activation</sl-button>
            <sl-button @click=${() => this.addLayer("dropout")}>Dropout</sl-button>
            <sl-button @click=${() => this.addLayer("noise")}>Noise</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Shape</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("flatten")}>Flatten</sl-button>
            <sl-button @click=${() => this.addLayer("concat")}>Concatination</sl-button>
            <sl-button @click=${() => this.addLayer("reshape")}>Reshape</sl-button>
            </sl-button-group>
        </div>
        <div class="group">
            <p>Combination</p>
            <sl-button-group>
            <sl-button @click=${() => this.addLayer("add")}>Addition</sl-button>
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
        <ref-select id="feature-select" elementType="webwriter-features" elemId=${this.featureWidgetId} typeName="Features" @refchange=${this._handleRefChange}></ref-select>
      </div>
    `
    }

    public addLayer(type) {
        let layer = this.currentCanvas.createLayer(type);
    }
    public zoomIn() {
        this.currentCanvas.controler.zoomIn();
    }
    public zoomOut() {
        this.currentCanvas.controler.zoomOut();
    }
    public zoomReset() {
        this.currentCanvas.controler.zoomReset();
    }

    getModel() {
        return this.currentCanvas.controler.export();
    }

}