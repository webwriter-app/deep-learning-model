import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js"
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js"
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js"
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js"
import { DatasetInput } from "../components/dataset-input/dataset-input"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import { registerCommunicator, Communicator } from "../lib/apis/com";
import * as tf from '@tensorflow/tfjs';
import { setupLayerRenderer } from "../lib/types/layers"
import Drawflow from "drawflow";


@customElement("webwriter-design")
export class AiWidgetsDesigns extends LitElementWw {
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "dataset-input": DatasetInput,
        "sl-option": SlOption,
        "sl-select": SlSelect
    }

    static styles = css`
    :host {
      min-height: 200px;
      display:block;
      font-size: 0.9rem;
    }
    #drawflow {
      display:block;
      height: 500px;
      min-width: 300px;
    }
    #drawflow p.label {


    }

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
        perspective:0
    }
    .drawflow .drawflow-node {
        display:flex;
        align-items:flex-start;
        position:absolute;
        background:#fff;
        min-width:100px;
        min-height:20px;
        border-radius:4px;
        border:2px solid #000;
        color:#000;
        z-index:2;
        padding:0px 15px;
        padding-top: 10px;
    }
    .drawflow .drawflow-node.multi-input .output {
        position:relative;
        top:40px;
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
    .drawflow .drawflow-node h4 {
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
        border:2px solid #000;
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

    }

    public options: Record<string, OptionDeclaration> = {}

    private possibleLayers;

    private saveInterval: NodeJS.Timeout;

    private currentCanvas: HTMLDivElement;

    public render(): TemplateResult {
        let that = this;
        console.log("render");
        setTimeout(function () {
            if (that.currentCanvas)
                that.currentCanvas.outerHTML = "";
            let canvas = document.createElement("div");
            canvas.id = "drawflow";
            that.shadowRoot.append(canvas)
            that.possibleLayers = setupLayerRenderer(canvas)
            that.currentCanvas = canvas;

            setTimeout(function () {
                if (that.state) {
                    let featureData = that.communicator.getDependency("features");
                    that.possibleLayers.import(JSON.parse(that.state as string), featureData.tensorDataset);
                }
                that.saveInterval = setInterval(function () {
                    that.state = JSON.stringify(that.possibleLayers.export())
                }, 1000);
            }, 100)
        }, 100)
        return html`
    <div id="add">
        <p>I/O</p>
        <sl-button @click=${() => this.addLayer("InputLayer")}>Input</sl-button>
        <sl-button @click=${() => this.addLayer("MultiInputLayer")}>Multi-Input</sl-button>
        <sl-button @click=${() => this.addLayer("AccessPoint")}>Access Point</sl-button>
        <sl-button @click=${() => this.addLayer("OutputLayer")}>Output</sl-button>
        <p>Deep Layers</p>
        <sl-button @click=${() => this.addLayer("ActivationLayer")}>Activation</sl-button>
        <sl-button @click=${() => this.addLayer("FCLLayer")}>Linear</sl-button>
        <sl-button @click=${() => this.addLayer("ProbabalisticLayer")}>Probabalistic</sl-button>
        <sl-button @click=${() => this.addLayer("DropoutLayer")}>Dropout</sl-button>
        <p>Misc</p>
        <sl-button @click=${() => this.addLayer("FlattenLayer")}>Flatten</sl-button>
        <sl-button @click=${() => this.addLayer("ConcatLayer")}>Concatination</sl-button>
        <sl-button @click=${() => this.addLayer("DeConcatLayer")}>DeConcatination Layer</sl-button>
        <sl-button @click=${() => this.addLayer("AddLayer")}>Add Layer</sl-button>
        <p>Combination</p>
    </div>`
    }
    public addLayer(type) {
        let featureData = this.communicator.getDependency("features");
        console.log(type, featureData);
        let layer = new this.possibleLayers[type](featureData.tensorDataset);
    }
}