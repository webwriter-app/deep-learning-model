import { readData, writeData } from "../lib/data-block";
import { msg } from "@lit/localize";
import { SlButton, SlButtonGroup, SlIcon, SlIconButton, SlInput, SlOption, SlSelect } from "@shoelace-style/shoelace";
import { LitElementWw } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { ModelEditor } from "../components/model-editor";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import LOCALIZE from "../localization/generated";
import { AiWidgetsFeatures } from "./webwriter-feature-engineering";

/**
 * A widget to design AI models using a visual editor.
 */
@customElement("webwriter-model-designing")
export class AiWidgetsDesigns extends LitElementWw {
    readonly options = {
        featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: {_: "Feature source", de: "Merkmalsquelle"}},
        editMode: {type: "select" as const, label: {_: "Edit permissions", de: "Bearbeitungsrechte"}, options: [{value: "edit", label: {_: "Edit everything", de: "Alles bearbeiten"}}, {value: "read", label: {_: "Read only", de: "Nur lesen"}}, {value: "layer", label: {_: "Layer properties only", de: "Nur Ebeneneigenschaften"}}, {value: "hidden", label: {_: "Hide widget", de: "Widget ausblenden"}}]},
        maxModelParameters: {type: Number, min: 1, max: 1000000, step: 100, label: {_: "Max model parameters", de: "Maximale Modellparameter"}},
        maxLayerParameters: {type: Number, min: 1, max: 100000, step: 10, label: {_: "Max layer parameters", de: "Maximale Ebenenparameter"}},
    };

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

    protected localize = LOCALIZE;

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
    }
    #delete-control {
        position:absolute;
        right: 5px;
        bottom: 110px;
        z-index: 10;
    }`

    /**
     * Stores the state of the model editor as a json string
     */
    private lastDesign: string | null = null;

    get state() {
        const {design} = readData<{design: unknown[]}>(this);
        return design ? JSON.stringify(design) : "";
    }

    private set state(value: string) {
        writeData(this, {design: JSON.parse(value)});
        this.lastDesign = value;
    }

    private syncDesign() {
        const value = this.state;
        if (!this.currentCanvas || value === this.lastDesign) return;
        this.lastDesign = value;
        if (value) this.currentCanvas.setState(JSON.parse(value));
        else this.currentCanvas.setState([]);
    }

    protected firstUpdated() {
        this.syncDesign();
        this.refreshStats();
    }

    private statsTimer?: ReturnType<typeof setInterval>;

    private refreshStats() {
        if (!this.currentCanvas || this.statsTimer) return;
        this.statsTimer = setInterval(() => {
            const control = this.currentCanvas?.controler;
            if (!control) return;
            this.renderRoot.querySelector("#numberNodes").textContent = String(control.getNumberOfOperations());
            this.renderRoot.querySelector("#params").textContent = String(control.getNumberOfParameters());
        }, 100);
    }

    private dataObserver = new MutationObserver(() => this.syncDesign());

    connectedCallback() {
        super.connectedCallback();
        this.dataObserver.observe(this, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["type", "slot", "src"]});
        this.syncDesign();
        if (this.hasUpdated) this.refreshStats();
    }

    disconnectedCallback() {
        clearInterval(this.statsTimer);
        this.statsTimer = undefined;
        this.dataObserver.disconnect();
        super.disconnectedCallback();
    }


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
        featuresElem?.addEventListener("change", datasetChangeListener);
        if (featuresElem?.isReady && featuresElem.isReady()) {
            datasetChangeListener()
        }
        this.syncDesign();
    }

    /**
     * Reference to the current model editor canvas
     */
    @query("#model-editor")
    accessor currentCanvas: ModelEditor;

    /**
     * Whether a layer or connection is currently selected in the model editor.
     * Controls the visibility of the delete button.
     */
    @state()
    private accessor hasSelection = false;

    /**
     * Called when the selection inside the model editor changed
     */
    private _selectionChange(e: CustomEvent) {
        this.hasSelection = e.detail.selected;
    }

    /**
     * Called when the model design inside the model editor was changed
     * @param e 
     */
    private _editorChange(e: CustomEvent) {
        this.state = JSON.stringify(e.detail.state)
    }

    public render(): TemplateResult {
        return html`
        <div id="content" style=${this.editMode == "hidden" ? "display:none" : ""}>
            <model-editor id="model-editor" @modelchange=${this._editorChange} @selectionchange=${this._selectionChange} editmode=${this.editMode} modelparams=${this.maxModelParameters} layerparams=${this.maxLayerParameters}></model-editor>
            <div id="stats">
                <p>${msg("Number of Operations:")} <span id="numberNodes"></span></p>
                <p>${msg("Total Parameters:")} <span id="params"></span></p>
            </div>
            <div id="add" style="display:${this.editMode == "edit" ? "" : "none"}">
                <div class="group">
                    <p>${msg("Add I/O Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("input")}>${msg("Input")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("output")}>${msg("Output")}</sl-button>
                </div>
                <div class="group">
                    <p>${msg("Add Trainable Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("fcl")}>${msg("Linear")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("conv")}>${msg("Convolution")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("transposeconv")}>${msg("Transpose Convolution")}</sl-button>
                </div>
                <div class="group">
                    <p>${msg("Add misc. Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("activation")}>${msg("Activation")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("dropout")}>${msg("Dropout")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("noise")}>${msg("Noise")}</sl-button>
                </div>
                <div class="group">
                    <p>${msg("Add Shaping Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("flatten")}>${msg("Flatten")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("concat")}>${msg("Concatenation")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("reshape")}>${msg("Reshape")}</sl-button>
                </div>
                <div class="group">
                    <p>${msg("Add Combinational Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("add")}>${msg("Addition")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("attention")}>${msg("Attention")}</sl-button>
                </div>
            </div>
            <div id="controls">
                <sl-button @click=${() => this.zoomReset()}>${msg("Center View")}</sl-button>
                <sl-tooltip content=${msg("Zoom In")}><sl-button @click=${() => this.zoomIn()}>+</sl-button></sl-tooltip>
                <sl-tooltip content=${msg("Zoom Out")}><sl-button @click=${() => this.zoomOut()}>-</sl-button></sl-tooltip>
            </div>
            <div id="delete-control" style="display:${this.editMode == "edit" && this.hasSelection ? "" : "none"}">
                <sl-button variant="danger" @click=${() => this.currentCanvas.removeSelectedNode()}>${msg("Delete selected")}</sl-button>
            </div>
        </div>
        <p style=${this.editMode != "hidden" ? "display:none" : ""}>${msg("Model Design Widget hidden from students.")}</p>
        <div hidden>
            <ref-select id="feature-select" elementType="webwriter-feature-engineering" elemId=${this.featureWidgetId} typeName="Features" @refchange=${this._handleRefChange} ownerId=${this.id}></ref-select>
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