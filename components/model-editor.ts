import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { DatasetInput } from "../components/dataset-input/dataset-input"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import * as tf from '@tensorflow/tfjs';
import { setupLayerRenderer } from "../lib/types/layers"
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton } from "@shoelace-style/shoelace"
import { Editor } from "../lib/layers"

@customElement("model-editor")
export class ModelEditor extends LitElementWw {
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
    .drawflow .drawflow-node p, .drawflow .drawflow-node sl-input, .drawflow .drawflow-node sl-select {
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
    }`

    public controler: Editor;

    private state;
    public setState(state) {
        this.state = state;
        this.requestUpdate();
    }

    private fields;
    public setFields(fields) {
        this.fields = fields;
        this.requestUpdate();
    }

    public createLayer(name) {
        this.controler.createLayer(name, this.fields);
    }

    public onmodelchange() { };

    public render(): TemplateResult {
        let that = this;
        let canvas = document.createElement("div");
        canvas.id = "drawflow";
        this.controler = new Editor(canvas);
        this.controler.import(this.state || [], this.fields);
        canvas.addEventListener("mouseup", function () {
            that.onmodelchange();
        });
        return html`${canvas}`
    }
}