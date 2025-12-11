import { SlButton, SlButtonGroup, SlIcon, SlIconButton, SlInput, SlOption, SlSelect } from "@shoelace-style/shoelace";
import { LitElementWw } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ModelEditor } from "../components/model-editor";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { AiWidgetsFeatures } from "./webwriter-feature-engineering";

/**
 * A widget to design AI models using a visual editor.
 */
@customElement("webwriter-model-designing")
export class AiWidgetsDesigns extends LitElementWw {
    /** @internal */
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "model-editor": ModelEditor,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-icon": SlIcon,
        "sl-input": SlInput,
        "sl-icon-button": SlIconButton,
        "ref-select": AiWidgetsReferenceSelect
    }

    static styles = css`
    :host {
      display:block;
      font-size: 0.9rem;
    }
    :host([contenteditable][editmode="hidden"]) {
      min-height: 30px;
      background:lightgray;
      font-size: inherit;
    }
    :host div[part='options'] {
      display:none;
    }
    :host([contenteditable]) div[part='options'] {
      display:block;
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
    #content {
        position:relative;
    }
    #stats p {
        margin: 0px;
    }
    #add {
        background-color:rgba(255,255,255,0.8);
        position: absolute;
        bottom: 25px;
        left:3px;
        width: calc(100% - 24px);
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-items: center;
        align-content: flex-end;
        gap: 5px 15px;
        overflow: auto;
        padding: 5px 10px;
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
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        gap:5px;
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

    /**
     * Stores the state of the model editor as a json string
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor state: string;

    /**
     * Stores the reference id of the widget where the dataset is used from
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    @query("#feature-select")
    private accessor refSelect: AiWidgetsReferenceSelect;

    /**
     * What students will be able to edit in the explorable. Ranging from "edit" = everything, "layer" = only layer settings, "read" = read only, to "hidden" = invisible to the students.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor editMode: "edit"|"layer"|"read"|"hidden" = "edit";

    /**
     * The maximum number of total parameters allowed for training the model. Only checked by the training widget.
     */
    @property({ type: Number, attribute: true, reflect: true })
    accessor maxModelParameters: number = 100000;

    /**
     * The maximum number of parameters allowed per layer to allow training the model.
     */
    @property({ type: Number, attribute: true, reflect: true })
    accessor maxLayerParameters: number = 10000;

    constructor() {
        super();
        let that = this;

        setInterval(function () {
            let nodes = that.currentCanvas.controler.getNumberOfOperations();
            that.shadowRoot.getElementById("numberNodes").innerText = String(nodes);

            let params = that.currentCanvas.controler.getNumberOfParameters();
            that.shadowRoot.getElementById("params").innerText = String(params);
        }, 100);

        // Prevents the del hotkey from removing the widget
        this.addEventListener("keydown", function (e) {
            if (e.key == "Delete") {
                e.preventDefault();
                return false;
            }
        })
    }

    /**
     * Called when the feature dataset source widget is changed.
     * @param e Contains e.detail.id for the new widget providing the dataset
     */
    private _handleRefChange(e: CustomEvent) {
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
        if (featuresElem.isReady && featuresElem.isReady()) {
            datasetChangeListener()
        }
        if (this.state && this.state != "")
            this.currentCanvas.setState(JSON.parse(this.state));
    }

    /**
     * Reference to the current model editor canvas
     */
    @query("#model-editor")
    accessor currentCanvas: ModelEditor;

    /**
     * Called when the model design inside the model editor was changed
     * @param e 
     */
    private _editorChange(e: CustomEvent) {
        this.state = JSON.stringify(e.detail.state)
    }

    public render(): TemplateResult {
        let that = this;
        function editModeChanged(e: Event) {
            const select = e.target as HTMLSelectElement;
            this.editMode = select.value;
            that.currentCanvas.editmode = that.editMode;
            that.currentCanvas.requestUpdate();
        }
        function modelParametersChanged(e: Event) {
            const input = e.target as SlInput;
            that.maxModelParameters = parseInt(input.value);
        }
        function layerParametersChanged(e: Event) {
            const input = e.target as SlInput;
            that.maxLayerParameters = parseInt(input.value);
        }

        return html`
        <div id="content" style=${this.editMode == "hidden" ? "display:none" : ""}>
            <model-editor id="model-editor" @modelchange=${this._editorChange} editmode=${this.editMode} modelparams=${this.maxModelParameters} layerparams=${this.maxLayerParameters}></model-editor>
            <div id="stats">
                <p>Number of Operation: <span id="numberNodes"></span></p>
                <p>Total Parameters: <span id="params"></span></p>
            </div>
            <div id="add" style="display:${this.editMode == "edit" ? "" : "none"}">
                <div class="group">
                    <p>Add I/O Layer</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("input")}>Input</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("output")}>Output</sl-button>
                </div>
                <div class="group">
                    <p>Add Trainable Layer</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("fcl")}>Linear</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("conv")}>Convolution</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("transposeconv")}>Transpose Convolution</sl-button>
                </div>
                <div class="group">
                    <p>Add misc. Layer</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("activation")}>Activation</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("dropout")}>Dropout</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("noise")}>Noise</sl-button>
                </div>
                <div class="group">
                    <p>Add Shaping Layer</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("flatten")}>Flatten</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("concat")}>Concatination</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("reshape")}>Reshape</sl-button>
                </div>
                <div class="group">
                    <p>Add Combinational Layer</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("add")}>Addition</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("attention")}>Attention</sl-button>
                </div>
            </div>
            <div id="controls">
                <sl-button @click=${() => this.zoomReset()}>Center View</sl-button>
                <sl-tooltip content="Zoom In"><sl-button @click=${() => this.zoomIn()}>+</sl-button></sl-tooltip>
                <sl-tooltip content="Zoom Out"><sl-button @click=${() => this.zoomOut()}>-</sl-button></sl-tooltip>
            </div>
        </div>
        <p style=${this.editMode != "hidden" ? "display:none" : ""}>Model Design Widget hidden from students.</p>
        <div part="options">
            <p>Feature Source</p>
            <ref-select id="feature-select" elementType="webwriter-feature-engineering" elemId=${this.featureWidgetId} typeName="Features" @refchange=${this._handleRefChange} ownerId=${this.id}></ref-select>
            <sl-select label="Edit Permissions" value=${this.editMode} @sl-change=${editModeChanged}>
                <sl-option value="hidden">hide widget</sl-option>
                <sl-option value="read">read only</sl-option>
                <sl-option value="layer">properties only</sl-option>
                <sl-option value="edit">edit everything</sl-option>
            </sl-select>
            <sl-input label="Max Model Parameters" type="number" step="100" value=${this.maxModelParameters} min="1" max="1000000" @sl-change=${modelParametersChanged}></sl-input>
            <sl-input label="Max Layer Parameters" type="number" step="10" value=${this.maxLayerParameters} min="1" max="100000" @sl-change=${layerParametersChanged}></sl-input>
        </div>`
    }
    
    /**
     * Zoom the canvas in
     */
    public zoomIn() {
        this.currentCanvas.controler.zoomIn();
    }
    /**
     * Zoom the canvas out
     */
    public zoomOut() {
        this.currentCanvas.controler.zoomOut();
    }
    /**
     * Reset the zoom of the canvas
     */
    public zoomReset() {
        this.currentCanvas.controler.zoomReset();
    }

    /**
     * Exports the current model design
     * @returns The model design
     */
    getModel() {
        return this.currentCanvas.controler.export();
    }
}