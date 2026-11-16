import type { MsgFn } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { LitElementWw } from "@webwriter/lit";
import { jsonData } from "@webwriter/lit/data";
import { localizer } from "@webwriter/lit/localize";
import { Shortcuts } from "@webwriter/lit/shortcuts";
import { css, html, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { localeOptions } from "../../localization/locale-options";
import { ModelEditor } from "../components/model-editor";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { analyze, exportLayers, featureSizes, importLayers, type FeatureSizes, type LayerState } from "../model/network";
import { WebwriterFeatureEngineering } from "./webwriter-feature-engineering";

type Labelled = { msg: MsgFn };

/**
 * A widget to design AI models using a visual editor.
 */
@customElement("webwriter-model-designing")
export class WebwriterModelDesigning extends LitElementWw {
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

    /** @internal */
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "model-editor": ModelEditor,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-icon": SlIcon,
        "sl-tooltip": SlTooltip,
        "sl-input": SlInput,
        "sl-icon-button": SlIconButton,
        "ref-select": AiWidgetsReferenceSelect
    }

    static options = {
        featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")},
        editMode: {
            type: "select" as const,
            label: (widget: Labelled) => widget.msg("Edit permissions"),
            options: [
                {value: "edit", label: (widget: Labelled) => widget.msg("Edit everything")},
                {value: "read", label: (widget: Labelled) => widget.msg("Read only")},
                {value: "layer", label: (widget: Labelled) => widget.msg("Layer properties only")},
                {value: "hidden", label: (widget: Labelled) => widget.msg("Hide widget")},
            ],
        },
        maxModelParameters: {type: Number, min: 1, max: 1000000, step: 100, label: (widget: Labelled) => widget.msg("Max model parameters")},
        maxLayerParameters: {type: Number, min: 1, max: 100000, step: 10, label: (widget: Labelled) => widget.msg("Max layer parameters")},
    }

    /** Delete removes the selected layer or connection. It has no button in the editor's drawer. */
    static actions = {
        deleteSelection: {label: (widget: Labelled) => widget.msg("Delete selected"), shortcut: ["Delete"], hidden: true},
    }

    readonly localize = localizer(this, localeOptions);
    public readonly msg = this.localize.msg;

    #data = jsonData<{design?: unknown[]}>(this, {defaults: {}, changed: () => this.syncDesign()});
    #shortcuts = new Shortcuts(this);

    /**
     * Stores the reference id of the widget where the dataset is used from
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

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

    /**
     * Whether a layer or connection is currently selected in the model editor.
     * Controls the visibility of the delete button.
     */
    @state()
    private accessor hasSelection = false;

    @query("#feature-select")
    private accessor refSelect: AiWidgetsReferenceSelect;

    /**
     * Reference to the current model editor canvas
     */
    @query("#model-editor")
    accessor currentCanvas: ModelEditor;

    /** The layers of the design that the editor shows. */
    @state()
    accessor layers: LayerState[] = [];

    /** The sizes of the features of the connected dataset. */
    @state()
    private accessor sizes: FeatureSizes | null = null;

    /**
     * Stores the state of the model editor as a json string
     */
    private lastDesign: string | null = null;

    get state() {
        const {design} = this.#data.get();
        return design ? JSON.stringify(design) : "";
    }

    private set state(value: string) {
        this.#data.set({design: JSON.parse(value)});
        this.lastDesign = value;
    }

    private get limits() {
        return {layer: this.maxLayerParameters, model: this.maxModelParameters};
    }

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

    connectedCallback() {
        super.connectedCallback();
        this.syncDesign();
    }

    private syncDesign() {
        const value = this.state;
        if (value === this.lastDesign) return;
        this.lastDesign = value;
        this.layers = importLayers(value ? JSON.parse(value) : []);
    }

    /** Removes the selected layer or connection. Declines the key where the editor does not allow it. */
    deleteSelection() {
        if (this.editMode != "edit" || !this.hasSelection)
            return false;
        this.currentCanvas.removeSelectedNode();
    }

    /**
     * Zoom the canvas in
     */
    public zoomIn() {
        this.currentCanvas.zoomIn();
    }
    /**
     * Zoom the canvas out
     */
    public zoomOut() {
        this.currentCanvas.zoomOut();
    }
    /**
     * Reset the zoom of the canvas
     */
    public zoomReset() {
        this.currentCanvas.zoomReset();
    }

    /**
     * Exports the current model design
     * @returns The model design
     */
    getModel() {
        return exportLayers(this.layers, this.sizes, this.limits);
    }

    /**
     * Called when the feature dataset source widget is changed.
     * @param e Contains e.detail.id for the new widget providing the dataset
     */
    private _handleRefChange(e: CustomEvent) {
        let that = this;
        let featuresElem = that.refSelect.getRefElement() as WebwriterFeatureEngineering | null;
        let datasetChangeListener = function () {
            const tensorDataset = featuresElem?.getDataset().tensorDataset;
            if (tensorDataset)
                that.sizes = featureSizes(tensorDataset);
        }

        if (e.detail.lastRef != null)
            e.detail.lastRef.removeEventListener("change", datasetChangeListener);

        that.featureWidgetId = e.detail.id;
        that.requestUpdate();
        featuresElem = (that.refSelect.getRefElement() as WebwriterFeatureEngineering | null)
        featuresElem?.addEventListener("change", datasetChangeListener);
        if (featuresElem?.isReady && featuresElem.isReady()) {
            datasetChangeListener()
        }
        this.syncDesign();
    }

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
    private _editorChange(e: CustomEvent<{state: LayerState[]}>) {
        this.layers = e.detail.state;
        this.state = JSON.stringify(e.detail.state)
    }

    public render(): TemplateResult {
        const analysis = analyze(this.layers, this.sizes, this.limits);
        return html`
        <div id="content" style=${this.editMode == "hidden" ? "display:none" : ""}>
            <model-editor id="model-editor" .layers=${this.layers} .sizes=${this.sizes} @modelchange=${this._editorChange} @selectionchange=${this._selectionChange} editmode=${this.editMode} modelparams=${this.maxModelParameters} layerparams=${this.maxLayerParameters}></model-editor>
            <div id="stats">
                <p>${this.msg("Number of Operations:")} <span id="numberNodes">${analysis.operations}</span></p>
                <p>${this.msg("Total Parameters:")} <span id="params">${analysis.parameters}</span></p>
            </div>
            <div id="add" style="display:${this.editMode == "edit" ? "" : "none"}">
                <div class="group">
                    <p>${this.msg("Add I/O Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("input")}>${this.msg("Input")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("output")}>${this.msg("Output")}</sl-button>
                </div>
                <div class="group">
                    <p>${this.msg("Add Trainable Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("fcl")}>${this.msg("Linear")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("conv")}>${this.msg("Convolution")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("transposeconv")}>${this.msg("Transpose Convolution")}</sl-button>
                </div>
                <div class="group">
                    <p>${this.msg("Add misc. Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("activation")}>${this.msg("Activation")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("dropout")}>${this.msg("Dropout")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("noise")}>${this.msg("Noise")}</sl-button>
                </div>
                <div class="group">
                    <p>${this.msg("Add Shaping Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("flatten")}>${this.msg("Flatten")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("concat")}>${this.msg("Concatenation")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("reshape")}>${this.msg("Reshape")}</sl-button>
                </div>
                <div class="group">
                    <p>${this.msg("Add Combinational Layer")}</p>
                    <sl-button @click=${() => this.currentCanvas.createLayer("add")}>${this.msg("Addition")}</sl-button>
                    <sl-button @click=${() => this.currentCanvas.createLayer("attention")}>${this.msg("Attention")}</sl-button>
                </div>
            </div>
            <div id="controls">
                <sl-button @click=${() => this.zoomReset()}>${this.msg("Center View")}</sl-button>
                <sl-tooltip content=${this.msg("Zoom In")}><sl-button @click=${() => this.zoomIn()}>+</sl-button></sl-tooltip>
                <sl-tooltip content=${this.msg("Zoom Out")}><sl-button @click=${() => this.zoomOut()}>-</sl-button></sl-tooltip>
            </div>
            <div id="delete-control" style="display:${this.editMode == "edit" && this.hasSelection ? "" : "none"}">
                <sl-button variant="danger" @click=${() => this.currentCanvas.removeSelectedNode()}>${this.msg("Delete selected")}</sl-button>
            </div>
        </div>
        <p style=${this.editMode != "hidden" ? "display:none" : ""}>${this.msg("Model Design Widget hidden from students.")}</p>
        <div hidden>
            <ref-select id="feature-select" elementType="webwriter-feature-engineering" elemId=${this.featureWidgetId} typeName="Features" @refchange=${this._handleRefChange} ownerId=${this.id}></ref-select>
        </div>`
    }
}
