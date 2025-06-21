import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { DatasetInput } from "../components/dataset-input/dataset-input"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import { registerCommunicator, Communicator } from "../lib/apis/com";
import * as tf from '@tensorflow/tfjs';
import { setupLayerRenderer } from "../lib/types/layers"
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton } from "@shoelace-style/shoelace"


@customElement("webwriter-design")
export class AiWidgetsDesigns extends LitElementWw {
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "dataset-input": DatasetInput,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton
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
    }
    #drawflow {
      margin-top: 10px;
      display:block;
      height: 500px;
      min-width: 300px;
      border: 1px solid var(--sl-input-border-color);
    }
    #drawflow .drawflow::before {
        content: "";
        position: absolute;
        top: -20000px;
        left: -20000px;
        right: -20000px;
        bottom: -20000px;
        background: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV8/tCIVh1YQcchQneyiIrqVKhbBQmkrtOpgcukXNGlIUlwcBdeCgx+LVQcXZ10dXAVB8APEXXBSdJES/5cUWsR4cNyPd/ced+8Ab7PKFMMfAxTV1NOJuJDLrwqBV/RiCH7MISQyQ0tmFrNwHV/38PD1Lsqz3M/9OQbkgsEAj0AcY5puEm8Qz2yaGud94jArizLxOfGEThckfuS65PAb55LNXp4Z1rPpeeIwsVDqYqmLWVlXiKeJI7KiUr4357DMeYuzUq2z9j35C4MFdSXDdZqjSGAJSaQgQEIdFVRhIkqrSoqBNO3HXfwjtj9FLolcFTByLKAGBaLtB/+D390axalJJykYB3peLOtjDAjsAq2GZX0fW1brBPA9A1dqx19rArOfpDc6WuQIGNwGLq47mrQHXO4Aw0+aqIu25KPpLRaB9zP6pjwQugX615ze2vs4fQCy1NXyDXBwCIyXKHvd5d193b39e6bd3w/LsnLKuRkBrwAAAAZiS0dEAJQAlACU0L193gAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+kGFQQ7KvUYPNUAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAHklEQVQ4y2NgGAWjYBQMbvAfiokCTKPhNQpGwXACAAPIAgEuqw0aAAAAAElFTkSuQmCC") repeat;
        z-index: -1; /* places it behind the content */
    }
    #drawflow p.label {}

    .drawflow,.drawflow .parent-node {
        position:relative
    }
    .parent-drawflow {
        display:flex;
        overflow:hidden;
        touch-action:none;
        outline:0
    }
    .drawflow {
        width:100%;
        height:100%;
        user-select:none;
        perspective:0;
        image-rendering: optimizeQuality;
    }
    .drawflow .drawflow-node {
        display:flex;
        align-items:flex-start;
        position:absolute;
        background:#fff;
        min-width:100px;
        min-height:20px;
        border-radius:4px;
        border:1px solid #000;
        color:#000;
        z-index:2;
        padding:10px 15px;
    }
    .drawflow .drawflow-node.multi-input .output {
        position:relative;
        top:25px;
    }
    .drawflow .drawflow-node.multi-input p {
        position:relative;
        line-height: 80%;
        padding:0px;
        margin: 0px;
    }
    .drawflow .drawflow-node p, .drawflow .drawflow-node input, .drawflow .drawflow-node select {
        max-width: 100px;
    }
    .drawflow .drawflow-node p {
        position: relative;
        margin: 0px;
    }
    .drawflow .drawflow-node.selected {
        background:#ddd
    }
    .drawflow .drawflow-node:hover {
        cursor:move
    }
    .drawflow .drawflow-node .inputs,.drawflow .drawflow-node .outputs {
        width:0
    }
    .drawflow .drawflow-node .drawflow_content_node {
        width:100%;
        display: flex;
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: center;
    }
    .drawflow .drawflow-node .drawflow_content_node div {
        width:100%;
        display: flex;
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: center;
    }
    .drawflow .drawflow-node .input,.drawflow .drawflow-node .output {
        position:relative;
        width:20px;
        height:fit-content;
        background:#fff;
        border-radius:0%;
        border:1px solid #000;
        cursor:crosshair;
        z-index:1;
        margin-bottom:5px;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        writing-mode: sideways-rl;
        text-orientation: mixed;
        padding: 5px 2px;
    }
    .drawflow .drawflow-node .input {
        left:-30px;
        top:2px;
        background:#000;
    }
    .drawflow .drawflow-node .output {
        right:-2px;
        top:2px;
        background:#fff;
    }
    .drawflow .drawflow-node .invalid {
        background:#f00;
    }
    .drawflow .drawflow-node .valid {
        background:#fff;
    }
    .drawflow svg {
        z-index:0;
        position:absolute;
        overflow:visible!important
    }
    .drawflow .connection {
        position:absolute;
        pointer-events:none;
        aspect-ratio:1/1
    }
    .drawflow .connection .main-path {
        fill:none;
        stroke-width:5px;
        stroke:#4682b4;
        pointer-events:all
    }
    .drawflow .connection .main-path:hover {
        stroke:#1266ab;
        cursor:pointer
    }
    .drawflow .connection .main-path.selected {
        stroke:#43b993
    }
    .drawflow .connection .point {
        cursor:move;
        stroke:#000;
        stroke-width:2;
        fill:#fff;
        pointer-events:all
    }
    .drawflow .connection .point.selected,.drawflow .connection .point:hover {
        fill:#1266ab
    }
    .drawflow .main-path {
        fill:none;
        stroke-width:5px;
        stroke:#4682b4
    }
    .drawflow-delete {
        position:absolute;
        display:block;
        width:30px;
        height:30px;
        background:#000;
        color:#fff;
        z-index:4;
        border:2px solid #fff;
        line-height:30px;
        font-weight:700;
        text-align:center;
        border-radius:50%;
        font-family:monospace;
        cursor:pointer
    }
    .drawflow>.drawflow-delete {
        margin-left:-15px;
        margin-top:15px
    }
    .parent-node .drawflow-delete {
        right:-15px;
        top:-15px
    }

  `
    @property({ type: String, attribute: true, reflect: true })
    accessor state: String;

    private communicator: Communicator;

    constructor() {
        super();
        let that = this;
        this.communicator = registerCommunicator("design", ["features"], function () {
            return {};
        }, function (name, data) {
            console.log(name, data)
        })
        setInterval(function () {
            let nodes = that.possibleLayers.getNumberOfOperations();
            that.shadowRoot.getElementById("numberNodes").innerText = nodes;

            let params = that.possibleLayers.getNumberOfParameters();
            that.shadowRoot.getElementById("params").innerText = params;
        }, 100);
    }

    public options: Record<string, OptionDeclaration> = {}

    private possibleLayers;

    private saveInterval: NodeJS.Timeout;

    private currentCanvas: HTMLDivElement;

    public updated(_changedProperties: PropertyValues): void {
        if (this.currentCanvas)
            return;
        let canvas = document.createElement("div");
        canvas.id = "drawflow";
        this.shadowRoot.prepend(canvas)
        this.possibleLayers = setupLayerRenderer(canvas)
        this.currentCanvas = canvas;


        let that = this;
        setTimeout(function () {
            if (that.state) {
                let featureData = that.communicator.getDependency("features");
                that.possibleLayers.import(JSON.parse(that.state as string), featureData.tensorDataset);
            }
            that.saveInterval = setInterval(function () {
                that.state = JSON.stringify(that.possibleLayers.export())
            }, 1000);
        }, 100)
    }

    public render(): TemplateResult {
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
    `
    }
    public addLayer(type) {
        let featureData = this.communicator.getDependency("features");
        console.log(type, featureData);
        let layer = new this.possibleLayers[type](featureData.tensorDataset);
    }
    public zoomIn() {
        this.possibleLayers.editor.zoom *= 1.1;
        this.possibleLayers.editor.zoom_refresh();
    }
    public zoomOut() {
        this.possibleLayers.editor.zoom /= 1.1;
        this.possibleLayers.editor.zoom_refresh();
    }
    public zoomReset() {
        this.possibleLayers.editor.zoom = 1;
        let pos = this.possibleLayers.getAveragePosition();
        this.possibleLayers.editor.canvas_x = -pos.x + this.possibleLayers.editor.precanvas.clientWidth / 2;
        this.possibleLayers.editor.canvas_y = -pos.y + this.possibleLayers.editor.precanvas.clientHeight / 2;
        this.possibleLayers.editor.zoom_refresh();
    }
}