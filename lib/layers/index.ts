import Drawflow, { DrawflowConnection, DrawflowConnectionDetail } from 'drawflow'
import { TransformedDataset } from '../dataset/dataset';
import * as tf from '@tensorflow/tfjs';
import { SlInput, SlSelect } from '@shoelace-style/shoelace';

type NonEmptyArray<T> = [T, ...T[]];
type Constructor<T> = new (...args: any[]) => T;


export const SIZE_SEP = "×";

export async function createLayer(name, ...args) {
    const module = await import('./' + name + ".ts");
    const LayerClass = module.ExportLayer;
    return new LayerClass(...args);
}

export class Editor {
    private editor: Drawflow;
    private layers: Record<number, Layer> = {};

    constructor(container: HTMLDivElement) {
        let that = this;
        this.editor = new Drawflow(container);
        this.editor.reroute = false;
        this.editor.start();
        this.editor.zoom_max = 1.6;
        this.editor.zoom_min = 0.5;
        this.editor.zoom_value = 0.5;
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
                    res(null);
                }, 100)
            }, 100)
        })
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


export abstract class Layer {
    public id: number;
    public elem: HTMLElement;
    private inputsDiv: HTMLDivElement;
    private outputsDiv: HTMLDivElement;
    private events = {};
    public readonly type: string;
    public readonly editor: Editor;

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
    protected addNumberInput(label:string, min: number, max:number):SlInput {
        let input = document.createElement("sl-input");
        input.type = "number";
        input.min = String(min);
        input.value = String(max);
        input.addEventListener("sl-change", function () {
            if (parseInt(input.value) > max)
                input.value = String(max);
            if (isNaN(parseInt(input.value)) || parseInt(input.value) < min)
                input.value = String(min);
        });
        input.label = label;
        input.size = "small";
        this.elem.append(input);
        return input;
    }
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
        this.elem.append(select);
        return select;
    }
    protected addCustomElement(label:string, elem: HTMLElement):HTMLParagraphElement {
        let p = document.createElement("p");
        p.classList.add("label");
        p.innerHTML = label;
        p.append(elem);
        this.elem.append(p);
        return p;
    }
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
    public on(event: string, callback: Function) {
        if (this.events[event] == null)
            this.events[event] = [];
        this.events[event].push(callback);
    }
    public trigger(event: string, params: Record<string, any>) {
        if (this.events[event] == null)
            return;
        for (let cb of this.events[event])
            cb(params);
    }
    protected addInput() {
        this.editor.addNodeInput(this.id);
    }
    protected addOutput() {
        this.editor.addNodeOutput(this.id);
    }
    protected removeInputs() {
        let node = this.getNode();
        for (let input in node.inputs)
            this.editor.removeNodeInput(node.id, "input_1");
    }
    protected removeOutputs() {
        let node = this.getNode();
        for (let output in node.outputs)
            this.editor.removeNodeOutput(node.id, "output_1");
    }
    protected getNodeElement() {
        return this.elem.parentElement.parentElement;
    }
    protected getNodeInputElement(input: string) {
        return this.inputsDiv.getElementsByClassName(input)[0] as HTMLElement;
    }
    protected getNodeInputElements() {
        return this.inputsDiv.children;
    }
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
    protected getNodeOutputElement(output: string) {
        return this.outputsDiv.getElementsByClassName(output)[0] as HTMLElement;
    }
    protected getNodeOutputElements() {
        return this.outputsDiv.children;
    }
    protected getConnectedLayersForOutput(outputname: string) {
        let that = this;
        let output = this.getNode().outputs[outputname];
        return output.connections.map(function (value) {
            return that.editor.getLayerFromNodeId(parseInt(value.node));
        })
    }
    public getNumberOfParameters(): number {
        return 0;
    }
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
            type: this.type
        }
    }
    public setState(state: Record<string, any>) {
        let elem = this.getNodeElement();
        elem.style.left = state.posX + "px";
        elem.style.top = state.posY + "px";
    }
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
    protected updateInputLabels() {
        let outputElems = this.getConnectedInputElements();
        for (let o in outputElems) {
            this.getNodeInputElement(o).innerText = outputElems[o].innerText;
        }
        this.checkInputs();

    }
    protected notifyOutputChange() {
        let outputs = this.getNode().outputs
        for (let o in outputs) {
            let outputs = this.getConnectedLayersForOutput(o);
            for (let out of outputs) {
                if (out != this)
                    out.update();
            }
        }
    }
    protected abstract update();
    public abstract forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor>;
}

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
    hasFreeInput() {
        let hasFreeInput = false;
        for (let input of this.getNodeInputElements()) {
            if ((input as HTMLElement).innerText == "")
                hasFreeInput = true;
        }
        return hasFreeInput;
    }
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
    abstract getOutputDim(): NonEmptyArray<number>[];
}

/*import { InputLayer } from './input'; 
import { OutputLayer } from './output';
import { ActivationLayer } from './activation';
import { FCLLayer } from './fcl';
import { FlattenLayer } from './flatten';
const LAYER_TYPES = {
    "input":InputLayer,
    "output":OutputLayer,
    "activation":ActivationLayer,
    "linear":FCLLayer,
    "flatten":FlattenLayer
};*/