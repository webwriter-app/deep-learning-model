import { SlInput, SlSelect } from '@shoelace-style/shoelace';
import Drawflow, { DrawflowConnectionDetail } from 'drawflow';
import { TransformedDataset } from '../dataset/dataset';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

type NonEmptyArray<T> = [T, ...T[]];
type Constructor<T> = new (...args: any[]) => T;


export const SIZE_SEP = "×";

export async function createLayer(name, ...args) {
    const module = await import('./' + name + ".ts");
    const LayerClass = module.ExportLayer;
    return new LayerClass(...args);
}

/** Contains the model editor of the model design widget. Wrapper Class for easier control of Drawflow. */
export class Editor {
    private editor: Drawflow;
    private layers: Record<number, Layer> = {};

    /** The editMode from the model design widget. */
    public readonly editMode: string;

    /** The max model params from the model design widget. */
    public readonly maxModelParams: number;

    /** The max layer params from the model design widget. */
    public readonly maxLayerParams: number;

    constructor(container: HTMLDivElement, editMode:string = "edit", maxModelParams:number, maxLayerParams:number) {
        let that = this;
        this.editMode = editMode;
        this.maxModelParams = maxModelParams;
        this.maxLayerParams = maxLayerParams;
        this.editor = new Drawflow(container);
        this.editor.reroute = false;
        this.editor.start();
        this.editor.zoom_max = 1.6;
        this.editor.zoom_min = 0.5;
        this.editor.zoom_value = 0.5;
        this.editor.editor_mode = editMode == "edit" ? "edit": "fixed";
        this.editor.on("connectionCreated", function ({ output_id, input_id, output_class, input_class }) {
            let outNode = that.editor.getNodeFromId(output_id);
            let inNode = that.editor.getNodeFromId(input_id);
    
            let outLayer = that.getLayer(outNode.id);
            let inLayer = that.getLayer(inNode.id);
    
            if (inNode.inputs[input_class].connections.length == 2) {
                that.editor.removeSingleConnection(output_id, input_id, output_class, input_class);
                return;
            }
    
            inLayer.trigger("connect", { layer: outLayer, output: output_class, input: input_class });
        })
        this.editor.on("connectionRemoved", function ({ output_id, input_id, output_class, input_class }) {
            let outNode = that.editor.getNodeFromId(output_id);
            let inNode = that.editor.getNodeFromId(input_id);
    
            let outLayer = that.getLayer(outNode.id);
            let inLayer = that.getLayer(inNode.id);
    
            if (inNode.inputs[input_class].connections.length == 1)
                return;
    
            inLayer.trigger("disconnect", { layer: outLayer, output: output_class, input: input_class });
        })
        this.editor.on("nodeRemoved", function (id) {
            delete that.layers[id];
        })
    }
    /** Returns the average position of the layer nodes. Used to center the view. */
    getAveragePosition() {
        let pos: { x: number, y: number } = { x: 0, y: 0 };
        let count = 0;
        for (let layer of Object.values(this.layers)) {
            pos.x += layer.getNode().pos_x;
            pos.y += layer.getNode().pos_y;
            count++;
        }
        if (count > 0) {
            pos.x /= count;
            pos.y /= count;
        }
        return pos;
    }
    getNumberOfParameters() {
        let sum = 0;
        Object.values(this.layers).forEach(element => {
            sum += element.getNumberOfParameters();
        });
        return sum;
    }
    getNumberOfOperations() {
        return Object.values(this.layers).filter(l => ["Input", "Output"].indexOf(l.type) == -1).length;
    }
    public createLayer(name, fields) {
        createLayer(name, fields, this);
    }
    /**
     * Returns a list of layers with the dependencies for inputs.
     */
    public export() {
        let layers = Object.values(this.layers).map(value => value.getState()).sort((a, b) => a.id - b.id)
        let currentId = 1;
        for (let layer of layers) {
            let lastId = layer.id;
            layer.id = currentId;
            for (let connectedAsInputLayer of layers) {
                let connections: Record<string, DrawflowConnectionDetail> = connectedAsInputLayer.inputConnections
                if (Object.keys(connections).length == 0)
                    continue;
                for (let connection of Object.values(connections)) {
                    if (parseInt(connection.node) == lastId)
                        connection.node = String(currentId);
                }
            }
            currentId++;
        }
        return layers;
    }

    /**
     * Sets the model editor state to the layers of the input.
     * @param layers The list of layers created by export.
     * @param fields A tensor dataset which is used to get the names and input/output dimensions.
     */
    public async import(layers:any[], fields:TransformedDataset) {
        let that = this;
        return new Promise(async function(res, rej) {
            let createdLayers = [];
            layers = layers.sort(function (a, b) {
                return parseInt(a.id) - parseInt(b.id);
            })
            for (let layer of layers) {
                let createdLayer = await createLayer(layer.type, fields, that);
                createdLayer.setState(layer);
                createdLayers.push(createdLayer);
            }
            setTimeout(function () {
                for (let layer of layers) {
                    for (let input in layer.inputConnections) {
                        let connection = layer.inputConnections[input];
                        if (connection != null) {
                            that.editor.addConnection(connection.node, layer.id, connection.input, input)
                        }
                    }
                }
                for (let layer of createdLayers)
                    if (layer.type == "input")
                        layer.update();
                
                setTimeout(function() {
                    for (let layer of layers) {
                        for (let input in layer.inputConnections) {
                            let connection = layer.inputConnections[input];
                            if (connection != null) {
                                that.editor.addConnection(connection.node, layer.id, connection.input, input)
                            }
                        }
                    }
                    setTimeout(function() {
                        for (let layer of layers) {
                            that.updateConnectionNodes(layer);
                        }
                    })
                    res(null);
                }, 100)
            }, 100)
        })
    }
    public updateConnectionNodes(layer: Layer) {
        this.editor.updateConnectionNodes('node-'+layer.id);
    }
    public getOutputs():Array<Layer> {
        return Object.values(this.layers).filter(l => l.getState().type == "output");
    }
    public getInputs():Array<Layer> {
        return Object.values(this.layers).filter(l => l.getState().type == "input");
    }
    public registerLayer(layer: Layer) {
        this.layers[layer.id] = layer;
    }
    public getLayer(id: number) {
        return this.layers[id];
    }
    public getLayerFromNodeId(id: number) {
        return Object.values<Layer>(this.layers).filter(l => l.id == id)[0];
    }
    public getNodeFromId(id: number) {
        return this.editor.getNodeFromId(id);
    }
    public addLayer(inputs, outputs): number {
        return this.editor.addNode('layer', inputs, outputs, -this.editor.canvas_x + this.editor.precanvas.clientWidth / 2 - 50, -this.editor.canvas_y + this.editor.precanvas.clientHeight / 2 - 50, 'layer', {}, "", false) as number;
    }
    public getNodeElement(id:number):HTMLDivElement {
        return this.editor.container.querySelector("#node-" + id) as HTMLDivElement;
    }
    public addNodeInput(id:number) {
        return this.editor.addNodeInput(id);
    }
    public addNodeOutput(id:number) {
        return this.editor.addNodeInput(id);
    }
    public removeNodeInput(id:number, input:string) {
        return this.editor.removeNodeInput(id, input);
    }
    public removeNodeOutput(id:number, input:string) {
        return this.editor.removeNodeInput(id, input);
    }
    public zoomIn() {
        this.editor.zoom *= 1.1;
        this.editor.zoom_refresh();
    }
    public zoomOut() {
        this.editor.zoom /= 1.1;
        this.editor.zoom_refresh();
    }
    public zoomReset() {
        this.editor.zoom = 1;
        let pos = this.getAveragePosition();
        this.editor.canvas_x = -pos.x + this.editor.precanvas.clientWidth / 2;
        this.editor.canvas_y = -pos.y + this.editor.precanvas.clientHeight / 2;
        this.editor.zoom_refresh();
    }
}

/** Base Layer class */
export abstract class Layer {
    public id: number;
    public elem: HTMLElement;
    private inputsDiv: HTMLDivElement;
    private outputsDiv: HTMLDivElement;
    private events = {};
    public readonly type: string;
    public readonly editor: Editor;
    private hasCyclicReference = false;
    private hasUpdatedOutputsThisUpdate = false;

    /**
     * Creates the drawflow node and sets the name and number of input/output fields
     * @param inputs The number of possible input connections
     * @param outputs The number of possible output connections
     * @param name The name/type of the layer.
     * @param editor Refference to the model editor used for settings.
     */
    constructor(inputs: number, outputs: number, name: string, editor: Editor) {
        this.editor = editor;
        this.id = editor.addLayer(inputs, outputs);
        this.type = name || "Layer";

        let nodeElement = editor.getNodeElement(this.id);
        this.inputsDiv = nodeElement.getElementsByClassName("inputs")[0] as HTMLDivElement;
        this.outputsDiv = nodeElement.getElementsByClassName("outputs")[0] as HTMLDivElement;
        editor.registerLayer(this);

        let elem = document.createElement("div");
        let header = document.createElement("p");
        header.innerText = this.type;

        let nodeContentElement = nodeElement.getElementsByClassName("drawflow_content_node")[0] as HTMLDivElement;
        nodeContentElement.append(header);
        nodeContentElement.append(elem);
        this.elem = elem;

        let that = this;
        this.on("connect", function ({ layer, output, input }) {
            that.update();
        })
        this.on("disconnect", function ({ layer, output, input }) {
            let inputElem = that.getNodeInputElement(input)
            if (inputElem != null)
                inputElem.innerText = "";
            that.update();
        })
    }

    /**
     * Allows subclasses to add a number input field to the node.
     * @param label Label of the sl-input element
     * @param min Min possible value
     * @param max Max possible value
     * @returns sl-input element that was added to the drawflow node.
     */
    protected addNumberInput(label:string, min: number, max:number):SlInput {
        let that = this;

        let input = document.createElement("sl-input");
        input.type = "number";
        input.min = String(min);
        input.value = String(max);
        input.addEventListener("sl-change", function () {
            if (parseInt(input.value) > max) {
                input.value = String(max);
                input.oninput(null);
                input.onchange(null);
            }
            if (isNaN(parseInt(input.value)) || parseInt(input.value) < min) {
                input.value = String(min);
                input.oninput(null);
                input.onchange(null);
            }
        });
        input.addEventListener("keypress", function(e) {
            if (e.key == "Delete") {
                e.stopPropagation()
                return false;
            }
        })
        input.addEventListener("keydown", function(e) {
            if (e.key == "Delete") {
                e.stopPropagation()
                return false;
            }
        })
        input.addEventListener("keyup", function(e) {
            if (e.key == "Delete") {
                e.stopPropagation()
                return false;
            }
        })
        input.label = label;
        input.size = "small";
        input.disabled = this.editor.editMode == "read"
        this.elem.append(input);
        return input;
    }

    /**
     * Allows subclasses to add a select field to the node.
     * @param label Label of the sl-select element
     * @param options list of sl-options
     * @returns sl-select element that was added to the drawflow node.
     */
    protected addSelect(label:string, options: string[]):SlSelect {
        let select = document.createElement("sl-select");
        for (let act of options) {
            let option = document.createElement("sl-option");
            option.value = act;
            option.innerText = act;
            select.append(option)
        }
        select.label = label;
        select.size = "small";
        select.disabled = this.editor.editMode == "read"
        this.elem.append(select);
        return select;
    }

    /**
     * Allows subclasses to add a custom element to the node.
     * @param label Label of the custom element
     * @returns A paragraph wrapping the element that was added to the drawflow node.
     */
    protected addCustomElement(label:string, elem: HTMLElement):HTMLParagraphElement {
        let p = document.createElement("p");
        p.classList.add("label");
        p.innerHTML = label;
        p.append(elem);
        this.elem.append(p);
        return p;
    }

    /**
     * Allows subclasses to add a span element to the node.
     * @param label Label of the span element
     * @returns A paragraph wrapping the span that was added to the drawflow node.
     */
    protected addTextElement(label:string, elem: HTMLSpanElement):HTMLParagraphElement {
        let p = document.createElement("p");
        p.innerHTML = label;
        p.append(elem);
        this.elem.append(p);
        return p;
    }
    public getNode() {
        return this.editor.getNodeFromId(this.id);
    }
    /**
     * Allows to register a listener to an event for this layer
     * @param event the name of the event
     * @param callback listener
     */
    public on(event: string | "connect" | "disconnect", callback: Function) {
        if (this.events[event] == null)
            this.events[event] = [];
        this.events[event].push(callback);
    }
    /**
     * Triggers all listeners for the event
     * @param event the name of the event
     * @param params event data
     */
    public trigger(event: string, params: Record<string, any>) {
        if (this.events[event] == null)
            return;
        for (let cb of this.events[event])
            cb(params);
    }
    /**
     * Adds a node on the left side of the layer for an input.
     */
    protected addInput() {
        this.editor.addNodeInput(this.id);
    }
    /**
     * Adds a node on the right side of the layer for an output.
     */
    protected addOutput() {
        this.editor.addNodeOutput(this.id);
    }
    /**
     * Removes all the inputs on the left side of the layer.
     */
    protected removeInputs() {
        let node = this.getNode();
        for (let input in node.inputs)
            this.editor.removeNodeInput(node.id, "input_1");
    }
    /**
     * Removes all the outputs on the right side of the layer.
     */
    protected removeOutputs() {
        let node = this.getNode();
        for (let output in node.outputs)
            this.editor.removeNodeOutput(node.id, "output_1");
    }
    /**
     * @returns the html element that wraps the entire layer.
     */
    protected getNodeElement() {
        return this.elem.parentElement.parentElement;
    }
    /**
     * @param input Typically named "input_1", "input_2", ...
     * @returns the html element where the shape of the input with the name of the input.
     */
    protected getNodeInputElement(input: string) {
        return this.inputsDiv.getElementsByClassName(input)[0] as HTMLElement;
    }
    /**
     * @returns all the html elements where the shape of the inputs as innerHTML.
     */
    protected getNodeInputElements() {
        return this.inputsDiv.children;
    }
    /**
     * @returns all the html elements of the outputs for the connected inputs.
     */
    protected getConnectedInputElements() {
        let ret: Record<string, HTMLElement> = {};
        let inputs = this.getNodeInputElements();
        for (let i = 1; i <= inputs.length; i++) {
            let inputName = "input_" + i;
            let connection = this.getNode().inputs[inputName].connections[0];
            if (connection != null)
                ret[inputName] = this.editor.getLayerFromNodeId(parseInt(connection.node)).getNodeOutputElement(connection.input);
        }
        return ret;
    }
    /**
     * @returns all the layers and the name of the output for the connected inputs.
     */
    public getInputLayers() {
        let ret: Record<string, {outputField: string, outputOfLayer: Layer}> = {};
        let inputs = this.getNodeInputElements();
        for (let i = 1; i <= inputs.length; i++) {
            let inputName = "input_" + i;
            let connection = this.getNode().inputs[inputName].connections[0];
            if (connection != null)
                ret[inputName] = {outputField: connection.input, outputOfLayer:this.editor.getLayerFromNodeId(parseInt(connection.node))};
        }
        return ret;
    }
    /**
     * @param output Typically named "output_1", "output_2", ...
     * @returns the html element of the output node. 
     */
    protected getNodeOutputElement(output: string) {
        return this.outputsDiv.getElementsByClassName(output)[0] as HTMLElement;
    }
    /**
     * @returns all the html elements for the output nodes.
     */
    protected getNodeOutputElements() {
        return this.outputsDiv.children;
    }
    /**
     * @param outputname name of the output node. Typically "output_1", "output_2", ...
     * @returns all connected layers for that output node.
     */
    protected getConnectedLayersForOutput(outputname: string) {
        let that = this;
        let output = this.getNode().outputs[outputname];
        return output.connections.map(function (value) {
            return that.editor.getLayerFromNodeId(parseInt(value.node));
        })
    }
    /**
     * @returns the number of trainable parameters for trainable layers.
     */
    public getNumberOfParameters(): number {
        return 0;
    }
    /**
     * @returns the save state for the layer. Used in the setState method when loading the design again.
     */
    public getState(): Record<string, any> {
        let node = this.getNode();
        let elem = this.getNodeElement();
        let inputs = this.getNode().inputs;
        let keepInputs: Record<string, DrawflowConnectionDetail> = {}
        for (let i in inputs) {
            if (inputs[i].connections.length != 0)
                keepInputs[i] = inputs[i].connections[0];
        }
        return {
            id: node.id,
            posX: parseInt(elem.style.left),
            posY: parseInt(elem.style.top),
            inputConnections: keepInputs,
            type: this.type,
            valid: this.valid()
        }
    }
    /**
     * Uses the state produced by getState to restore the settings of the layer.
     * @param state produced by getState when saving.
     */
    public setState(state: Record<string, any>) {
        let elem = this.getNodeElement();
        elem.style.left = state.posX + "px";
        elem.style.top = state.posY + "px";
    }
    /**
     * Checks for all the inputs that the dimension in it's html is the same as the dimension of the connected output.
     * @returns whether all dimension match.
     */
    public checkInputs() {
        let that = this;
        let inputs = this.getNode().inputs
        for (let i in inputs) {
            let input = inputs[i];
            let inputName = i;
            if (input.connections.length == 0 || this.getNodeInputElement(inputName).innerText == "") {
                if (this.getNodeInputElement(inputName) == null)
                    this.addInput();
                setTimeout(function() {
                    that.getNodeInputElement(inputName).classList.remove("invalid");
                    that.getNodeInputElement(inputName).classList.remove("valid");
                })
                continue;
            }
            let layer = this.editor.getLayerFromNodeId(parseInt(input.connections[0].node));
            let output = input.connections[0].input;
            if (layer.getNodeOutputElement(output).innerText != this.getNodeInputElement(i).innerText) {
                this.getNodeInputElement(i).classList.add("invalid");
                this.getNodeInputElement(i).classList.remove("valid");
                this.getNodeInputElement(i).title = "data has wrong dimensions";
                return false;
            } else {
                this.getNodeInputElement(i).classList.remove("invalid");
                this.getNodeInputElement(i).classList.add("valid");
                this.getNodeInputElement(i).title = "";
            }
        }
        return true;
    }
    /**
     * Reads the dimensions of the connected output into the input for all the inputs.
     */
    protected updateInputLabels() {
        let outputElems = this.getConnectedInputElements();
        for (let o in outputElems) {
            this.getNodeInputElement(o).innerText = outputElems[o].innerText;
        }
        this.checkInputs();
        this.showValid();
    }
    /**
     * Calls the update method for all the connected output layers. This propagates changes in output dimension through the network.
     */
    protected notifyOutputChange() {
        if (this.hasUpdatedOutputsThisUpdate) {
            this.hasCyclicReference = true;
            this.showValid();
            return;
        }
        this.hasUpdatedOutputsThisUpdate = true;
        this.showValid();
        let outputs = this.getNode().outputs
        for (let o in outputs) {
            let outputs = this.getConnectedLayersForOutput(o);
            for (let out of outputs) {
                if (out != this) {
                    out.update();
                    out.editor.updateConnectionNodes(out);
                } else {
                    this.hasCyclicReference = true;
                }
            }
        }
        this.hasUpdatedOutputsThisUpdate = false;
        this.hasCyclicReference = false;
    }
    /**
     * Uses the result of the valid() method to display it to the layer html.
     */
    protected showValid() {
        let valid = this.valid();
        if (!valid) {
            this.getNodeElement().classList.add("invalid");
            if (this.hasCyclicReference)
                this.getNodeElement().setAttribute("title", "Has a cyclic reference.")
        } else {
            this.getNodeElement().classList.remove("invalid");
        }
    }
    /**
     * Contains any code that should run when any of the inputs is updated. 
     * When you want to read the new input dimensions use updateInputLabels().
     * When you have changed the output dimensions use notifyOutputChange to send the update through the network.
     */
    protected abstract update(): void;
    /**
     * Is called when a forward pass of the model is performed using tensorflow. Only called once during model building.
     * @param inputs The Symbolic Tensors provided by the prevoious layers.
     * @returns
     */
    public abstract forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor>;
    /**
     * Checks the state of the layer for inconsistencies and returns false when anything will cause an error when training.
     */
    public valid() {
        return this.checkInputs() && !this.hasCyclicReference;
    }
}

/** Extends the Base Layer with management for a dynamic number of inputs. */
export abstract class DynamicInputLayer extends Layer {
    constructor(outputs: number, name: string, editor:Editor) {
        super(1, outputs, name, editor);
    }
    update() {
        this.updateInputLabels();
        this.cleanEmptyInputs();
        if (!this.hasFreeInput())
            this.addInput();

        let dims = this.getOutputDim();
        let outputs = dims.length; // The main dimension is the number of individual outputs
        for (let out = 0; out < outputs; out++)
            this.getNodeOutputElement("output_" + (out + 1)).innerText = dims[out].join(SIZE_SEP)
        this.notifyOutputChange();
    }
    /**
     * @returns whether there is a node that is not connected.
     */
    hasFreeInput() {
        let hasFreeInput = false;
        for (let input of this.getNodeInputElements()) {
            if ((input as HTMLElement).innerText == "")
                hasFreeInput = true;
        }
        return hasFreeInput;
    }
    /**
     * Removes empty input nodes.
     * @returns whether there was a node that is not connected.
     */
    cleanEmptyInputs() {
        let hasFreeInput = false;
        for (let input of this.getNodeInputElements()) {
            if ((input as HTMLElement).innerText == "")
                this.editor.removeNodeInput(this.getNode().id, input.classList.value.split(" ")[1])
        }
        return hasFreeInput;
    }
    getState() {
        let state = super.getState();
        state.numberOfInputs = this.getNodeInputElements.length;
        state.dim = this.getOutputDim();
        return state;
    }
    setState(state) {
        super.setState(state);
        for (let i = 1; i < state.numberOfInputs; i++)
            this.addInput();
    }
    /**
     * @returns the combined output shapes for the layer operation on the inputs.
     */
    abstract getOutputDim(): NonEmptyArray<number>[];
}