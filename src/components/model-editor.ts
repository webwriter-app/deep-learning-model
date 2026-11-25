import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { LitElementWw } from "@webwriter/lit";
import { widgetMsg } from "@webwriter/lit/localize";
import { SceneController } from "@webwriter/lit/scene";
import { Viewport } from "@webwriter/lit/viewport";
import { ScenePath, sceneElements, type ConnectDetail, type MoveDetail, type SelectDetail } from "@webwriter/widget/scene";
import { PixiScene } from "@webwriter/widget/scene/pixi";
import { css, html, type PropertyValues, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
    analyze, changeLayer, connectLayers, disconnectLayers, exportLayers, inputPorts, moveLayers, newLayer, removeLayers,
    type Analysis, type FeatureSizes, type LayerState, type LayerType,
} from "../model/network";
import { layerFields, layerName } from "./layer-fields";

/** What is selected: a layer, or the connection that ends in an input port of a layer. */
type Selection = { layer: number } | { wire: string };

/** The key of a connection: the input it ends in, which takes one connection. Never taken apart again. */
const wireKey = (layer: LayerState, port: string) => `${layer.id}:${port}`;

/**
 * The model editor of the model design widget: the layers as nodes with their forms, and the connections between them.
 *
 * @event modelchange - The reader changed the design. `detail.state` is the new design as it is stored.
 * @event selectionchange - A layer or a connection was selected or unselected. `detail.selected` tells which.
 */
export class ModelEditor extends LitElementWw {
    readonly msg = widgetMsg(this);

    /** @internal */
    static scopedElements = {
        ...sceneElements,
        "ww-scene": PixiScene,
        "sl-input": SlInput,
        "sl-option": SlOption,
        "sl-select": SlSelect,
    };

    static styles = css`
    :host {
        min-height: 200px;
        display: block;
        font-size: 0.9rem;
        container-type: inline-size;
    }
    ww-scene {
        margin-top: 10px;
        display: block;
        height: 500px;
        min-width: 0;
        max-width: 100%;
        border: 1px solid var(--sl-input-border-color);
        outline: none;
        user-select: none;
    }
    ww-path {
        stroke: var(--ww-theme-accent-1, #4682b4);
        stroke-width: 5px;
    }
    ww-path:state(hover) {
        stroke: #1266ab;
    }
    ww-path[selected] {
        stroke: var(--ww-theme-accent-2, #43b993);
    }
    ww-node {
        display: flex;
        min-width: 100px;
        max-width: 200px;
        min-height: 20px;
        padding: 10px 15px;
        border: 1px solid #000;
        border-radius: 4px;
        background: #fff;
        color: #000;
    }
    ww-node[movable] {
        cursor: move;
    }
    ww-node[selected] {
        background: #ddd;
    }
    ww-node.invalid {
        background: #ff7;
    }
    ww-node:focus-within {
        z-index: 100;
    }
    .content {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    .content > div {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    .content p {
        margin: 0;
    }
    .content sl-select {
        width: 150px;
    }
    .content sl-input {
        width: 100px;
    }
    .invalid .content p span {
        color: #f00;
    }
    .inputs, .outputs {
        position: absolute;
        top: 12px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .inputs {
        left: -14px;
    }
    .outputs {
        right: -14px;
    }
    .port {
        box-sizing: content-box;
        width: 20px;
        min-height: 14px;
        padding: 5px 2px;
        border: 1px solid #000;
        background: #fff;
        cursor: crosshair;
        display: flex;
        align-items: center;
        justify-content: center;
        writing-mode: sideways-rl;
        text-orientation: mixed;
    }
    .port.input {
        background: #999;
    }
    .port.input.valid {
        background: #fff;
    }
    .port.input.invalid {
        background: #f77;
    }
    .port[data-ww-port-candidate] {
        background: var(--ww-theme-accent-3, #f59e0b);
    }
    .port[data-ww-port-over] {
        box-shadow: 0 0 0 4px #f59e0b66;
    }
    ww-node:focus-visible, .port:focus-visible {
        outline: 2px solid var(--ww-theme-accent-1, #4682b4);
        outline-offset: 2px;
    }
    @container (max-width: 520px) {
        ww-scene {
            height: 380px;
        }
    }
    @media print {
        ww-scene {
            break-inside: avoid;
        }
    }`;

    @property({ type: String }) accessor editmode = "edit";
    @property({ type: Number }) accessor modelparams = 100000;
    @property({ type: Number }) accessor layerparams = 10000;
    /** The layers of the design. */
    @property({ attribute: false }) accessor layers: LayerState[] = [];
    /** The sizes of the features of the dataset, or null while there is none. */
    @property({ attribute: false }) accessor sizes: FeatureSizes | null = null;

    @state() private accessor selection: Selection | null = null;

    readonly #viewport: Viewport = new Viewport(this, { can: () => !this.#scene.marquee });
    readonly #scene: SceneController = new SceneController(this, {
        can: () => this.editmode === "edit", viewport: this.#viewport.core, undoHost: "outermost",
    });
    #analysis?: Analysis;

    get analysis(): Analysis {
        return this.#analysis!;
    }

    protected willUpdate(changed: PropertyValues<this>) {
        if (!this.#analysis || changed.has("layers") || changed.has("sizes") || changed.has("layerparams") || changed.has("modelparams")) {
            this.#analysis = analyze(this.layers, this.sizes, { layer: this.layerparams, model: this.modelparams });
        }
    }

    /** The point of the scene in the middle of what the editor shows. */
    #center() {
        const scene = this.renderRoot.querySelector("ww-scene")!;
        const box = scene.getBoundingClientRect();
        return this.#scene.toScene(box.left + box.width / 2, box.top + box.height / 2);
    }

    #commit(layers: LayerState[]) {
        const state = exportLayers(layers, this.sizes, { layer: this.layerparams, model: this.modelparams });
        const before = layers.map(layer => layer.id).sort((a, b) => a - b);
        const renumbered = state.some((layer, index) => layer.id !== before[index]);
        this.layers = state;
        if (renumbered) this.#select(null);
        this.dispatchEvent(new CustomEvent("modelchange", { detail: { state } }));
    }

    #select(selection: Selection | null) {
        this.selection = selection;
        this.dispatchEvent(new CustomEvent("selectionchange", { detail: { selected: selection !== null } }));
    }

    /** Adds a layer in the middle of the editor. */
    public createLayer(type: LayerType) {
        const { x, y } = this.#center();
        this.#commit([...this.layers, newLayer(this.layers, type, { x: x - 50, y: y - 50 })]);
    }

    /** Removes the selected layer or connection. */
    public removeSelectedNode() {
        const selection = this.selection;
        if (selection === null) return;
        if ("wire" in selection) {
            const [id, port] = selection.wire.split(":");
            this.#commit(disconnectLayers(this.layers, Number(id), port));
        } else {
            this.#commit(removeLayers(this.layers, [selection.layer]));
        }
        this.#select(null);
    }

    public zoomIn() {
        this.#viewport.zoomBy(1.1);
    }

    public zoomOut() {
        this.#viewport.zoomBy(1 / 1.1);
    }

    /** Zoom 1, with the layers in the middle. */
    public zoomReset() {
        if (!this.layers.length) {
            this.#viewport.zoomTo(1);
            return;
        }
        const mean = {
            x: this.layers.reduce((sum, layer) => sum + layer.posX, 0) / this.layers.length,
            y: this.layers.reduce((sum, layer) => sum + layer.posY, 0) / this.layers.length,
        };
        this.#viewport.centerOn(mean, 1);
    }

    #onSelect(event: CustomEvent<SelectDetail>) {
        if (event.defaultPrevented) return;
        const item = event.detail.items[0];
        if (item instanceof ScenePath) {
            const to = this.#scene.endsOf(item).to;
            this.#select(to ? { wire: to.reference } : null);
        } else {
            this.#select(item ? { layer: Number(item.key) } : null);
        }
    }

    #onMove(event: CustomEvent<MoveDetail>) {
        this.#commit(moveLayers(this.layers, event.detail.items.map(({ key, x, y }) => ({ id: Number(key), x, y }))));
    }

    #onConnect(event: CustomEvent<ConnectDetail>) {
        const [from] = event.detail.from.split(":");
        const [to, port] = event.detail.to.split(":");
        const next = connectLayers(this.layers, Number(from), Number(to), port);
        if (next) this.#commit(next);
        else event.preventDefault();
    }

    #change = (id: number, settings: Record<string, unknown>) => {
        this.#commit(changeLayer(this.layers, id, settings));
    };

    #node(layer: LayerState): TemplateResult {
        const info = this.#analysis!.layers.get(layer.id)!;
        const key = String(layer.id);
        const name = layerName(layer.type, this.msg);
        const context = { msg: this.msg, editmode: this.editmode, sizes: this.sizes, change: this.#change };
        return html`<ww-node class=${info.valid ? "" : "invalid"} data-ww-key=${key} x=${layer.posX} y=${layer.posY} aria-label=${name}
            title=${info.cyclic ? this.msg("Has a cyclic reference.") : ""} selectable movable ?selected=${this.selection !== null && "layer" in this.selection && this.selection.layer === layer.id}>
            <div class="inputs">
                ${info.inputs.map(port => html`<div class="port input ${port.invalid ? "invalid" : port.wired && port.label ? "valid" : ""}"
                    data-ww-port=${port.name} data-ww-accept="wire" data-ww-side="left" title=${port.invalid ? "data has wrong dimensions" : ""}>${port.label}</div>`)}
            </div>
            <div class="content">
                <p>${name}</p>
                <div @pointerdown=${(event: Event) => event.stopPropagation()}>${layerFields(context, layer, info)}</div>
            </div>
            <div class="outputs">
                ${info.outputs.map(port => html`<div class="port output" data-ww-port=${port.name} data-ww-link="wire" data-ww-side="right">${port.label}</div>`)}
            </div>
        </ww-node>`;
    }

    public render(): TemplateResult {
        const wires = this.layers.flatMap(layer => inputPorts(layer).flatMap(port => {
            const connection = layer.inputConnections[port];
            return connection ? [{ layer, port, from: connection.node }] : [];
        }));
        return html`<ww-scene select="single" connect-click background="dots" background-spacing="22" data-ww-viewport="canvas" data-ww-viewport-zoom="0.5 1.6" data-ww-viewport-fit="none"
            @ww-select=${this.#onSelect} @ww-move=${this.#onMove} @ww-connect=${this.#onConnect}>
            ${wires.map(({ layer, port, from }) => html`<ww-path data-ww-key=${wireKey(layer, port)} from="${from}:output_1" to="${layer.id}:${port}"
                route="curve" selectable ?selected=${this.selection !== null && "wire" in this.selection && this.selection.wire === wireKey(layer, port)}></ww-path>`)}
            ${repeat(this.layers, layer => layer.id, layer => this.#node(layer))}
        </ww-scene>`;
    }
}
