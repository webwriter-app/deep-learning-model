import Drawflow, { DrawflowConnection, DrawflowConnectionDetail } from 'drawflow'
import { TransformedDataset } from './dataset';

type NonEmptyArray<T> = [T, ...T[]];

const SIZE_SEP = "×";

function wrapWithLabel(element: HTMLElement, label: string) {
    let p = document.createElement("p");
    p.classList.add("label");
    p.innerHTML = label;
    p.append(element);
    return p;
}

export function setupLayerRenderer(elem) {
    let editor = new Drawflow(elem);
    editor.reroute = false;
    editor.start();
    editor.zoom_max = 1.6;
    editor.zoom_min = 0.5;
    editor.zoom_value = 0.5;
    editor.on("connectionCreated", function ({ output_id, input_id, output_class, input_class }) {
        let outNode = editor.getNodeFromId(output_id);
        let inNode = editor.getNodeFromId(input_id);

        let outLayer = getLayer(outNode.id);
        let inLayer = getLayer(inNode.id);

        if (inNode.inputs[input_class].connections.length == 2) {
            editor.removeSingleConnection(output_id, input_id, output_class, input_class);
            return;
        }

        inLayer.trigger("connect", { layer: outLayer, output: output_class, input: input_class });
    })
    editor.on("connectionRemoved", function ({ output_id, input_id, output_class, input_class }) {
        let outNode = editor.getNodeFromId(output_id);
        let inNode = editor.getNodeFromId(input_id);

        let outLayer = getLayer(outNode.id);
        let inLayer = getLayer(inNode.id);

        if (inNode.inputs[input_class].connections.length == 1)
            return;

        inLayer.trigger("disconnect", { layer: outLayer, output: output_class, input: input_class });
    })
    editor.on("nodeRemoved", function (id) {
        delete LAYERS[id];
    })

    const LAYERS: Record<number, Layer> = {}
    function registerLayer(layer: Layer) {
        LAYERS[layer.id] = layer;
    }
    function getLayer(id: number) {
        return LAYERS[id];
    }
    function getLayerFromNodeId(id: number) {
        return Object.values<Layer>(LAYERS).filter(l => l.id == id)[0];
    }
    abstract class Layer {
        public id: number;
        public elem: HTMLElement;
        private inputsDiv: HTMLDivElement;
        private outputsDiv: HTMLDivElement;
        private events = {};
        public readonly type: string;

        constructor(inputs: number, outputs: number, name: string) {
            let html = ""
            let id = editor.addNode('layer', inputs, outputs, -editor.canvas_x + editor.precanvas.clientWidth / 2 - 50, -editor.canvas_y + editor.precanvas.clientHeight / 2 - 50, 'layer', { id: this.id }, html, false);
            this.id = id as number;
            this.type = name || "Layer";

            let nodeElement = editor.container.querySelector("#node-" + this.id);
            this.inputsDiv = nodeElement.getElementsByClassName("inputs")[0] as HTMLDivElement;
            this.outputsDiv = nodeElement.getElementsByClassName("outputs")[0] as HTMLDivElement;
            registerLayer(this);

            let elem = document.createElement("div");
            let header = document.createElement("p");
            header.innerText = this.type;

            let nodeContentElement = nodeElement.getElementsByClassName("drawflow_content_node")[0] as HTMLDivElement;
            nodeContentElement.append(header);
            nodeContentElement.append(elem);
            this.elem = elem;

            let that = this;
            this.on("connect", function ({ layer, output, input }) {
                //that.getNodeInputElement(input).innerText = layer.getNodeOutputElement(output).innerText;
                that.update();
            })
            this.on("disconnect", function ({ layer, output, input }) {
                that.getNodeInputElement(input).innerText = "";
                that.update();
            })
        }
        public getNode() {
            return editor.getNodeFromId(this.id);
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
            editor.addNodeInput(this.id);
        }
        protected addOutput() {
            editor.addNodeOutput(this.id);
        }
        protected removeInputs() {
            let node = this.getNode();
            for (let input in node.inputs)
                editor.removeNodeInput(node.id, "input_1");
        }
        protected removeOutputs() {
            let node = this.getNode();
            for (let output in node.outputs)
                editor.removeNodeOutput(node.id, "output_1");
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
                    ret[inputName] = getLayerFromNodeId(parseInt(connection.node)).getNodeOutputElement(connection.input);
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
            let output = this.getNode().outputs[outputname];
            return output.connections.map(function (value) {
                return getLayerFromNodeId(parseInt(value.node));
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
            let inputs = this.getNode().inputs
            for (let i in inputs) {
                let input = inputs[i];
                if (input.connections.length == 0 || this.getNodeInputElement(i).innerText == "") {
                    this.getNodeInputElement(i).classList.remove("invalid");
                    this.getNodeInputElement(i).classList.remove("valid");
                    continue;
                }
                let layer = getLayerFromNodeId(parseInt(input.connections[0].node));
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
    }

    abstract class DynamicInputLayer extends Layer {
        constructor(outputs: number, name: string) {
            super(1, outputs, name)
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
                    editor.removeNodeInput(this.getNode().id, input.classList.value.split(" ")[1])
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

    class InputLayer extends Layer {
        private fields: TransformedDataset;
        private select: HTMLSelectElement;

        constructor(fields: TransformedDataset) {
            super(0, 1, "Input")
            this.fields = fields;
            let select = document.createElement("select");
            for (let field of Object.keys(this.fields.featureMaps)) {
                let option = document.createElement("option");
                option.value = field;
                option.innerText = field;
                select.append(option);
            }
            this.select = select;
            this.elem.append(wrapWithLabel(select, "Input"))

            let that = this;
            select.onchange = function () {
                that.getNodeOutputElement("output_1").innerText = fields.featureMaps[select.value].size().join(SIZE_SEP);
                that.update();
            };
            select.onchange(null);
        }
        update() {
            super.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.select = this.select.value;
            state.type = "input";
            state.dim = this.fields.featureMaps[state.select].size();
            return state;
        }
        setState(state) {
            super.setState(state);
            this.select.value = state.select;
            this.select.onchange(null);
        }
    }

    class OutputLayer extends Layer {
        private fields: TransformedDataset;
        private select: HTMLSelectElement;
        private loss: HTMLSelectElement;

        constructor(fields) {
            super(1, 0, "Output")
            this.fields = fields;
            let select = document.createElement("select");
            for (let field of Object.keys(this.fields.featureMaps)) {
                let option = document.createElement("option");
                option.value = field;
                option.innerText = field;
                select.append(option);
            }

            this.select = select;
            this.elem.append(wrapWithLabel(select, "Output"))

            this.loss = document.createElement("select");
            for (let loss of ["BCE", "MAE", "MSE", "Hinge"]) {
                let option = document.createElement("option");
                option.value = loss;
                option.innerText = loss;
                this.loss.append(option);
            }
            this.elem.append(wrapWithLabel(this.loss, "Loss Function"))

            let that = this;
            select.onchange = function () {
                that.getNodeInputElement("input_1").innerText = that.fields.featureMaps[that.select.value].size().join(SIZE_SEP);
                that.update()
            };
            select.onchange(null);
        }
        update() {
            this.getNodeInputElement("input_1").innerText = this.fields.featureMaps[this.select.value].size().join(SIZE_SEP);
            super.checkInputs();
        }
        getState() {
            let state = super.getState();
            state.select = this.select.value;
            state.type = "output";
            state.dim = this.fields.featureMaps[state.select].size();
            state.loss = this.loss.value;
            return state;
        }
        setState(state: Record<string, any>) {
            super.setState(state);
            this.select.value = state.select;
            this.loss.value = state.loss;
            this.select.onchange(null);
        }
    }

    class FCLLayer extends Layer {
        private dimInput: HTMLInputElement;
        private params: HTMLElement;

        constructor() {
            super(1, 1, "Linear")

            this.dimInput = document.createElement("input");
            this.dimInput.type = "number";
            this.dimInput.min = String(1);
            this.dimInput.value = String(300);
            let that = this;
            this.dimInput.onchange = function () {
                if (parseInt(that.dimInput.value) > 300)
                    that.dimInput.value = "300";
                if (isNaN(parseInt(that.dimInput.value)))
                    that.dimInput.value = "1";

                that.getNodeOutputElement("output_1").innerText = that.dimInput.value;
                that.update();
                that.notifyOutputChange();
            }
            this.elem.append(wrapWithLabel(this.dimInput, "Output Nodes"));

            this.params = document.createElement("span");
            this.elem.append(wrapWithLabel(this.params, "Parameters: "));
            this.dimInput.onchange(null);
        }
        public getNumberOfParameters() {
            this.update();
            return parseInt(this.params.innerText);
        }
        update() {
            this.updateInputLabels();
            let inDim = parseInt(this.getNodeInputElement("input_1").innerText)
            let outDim = parseInt(this.dimInput.value)
            this.params.innerText = String(inDim * outDim);
        }
        getState() {
            let state = super.getState();
            state.dim = [parseInt(this.dimInput.value)];
            state.type = "fcl";
            return state;
        }

        setState(state) {
            super.setState(state);
            this.dimInput.value = state.dim;
            this.dimInput.onchange(null);
        }
    }
    

    class FlattenLayer extends Layer {
        constructor() {
            super(1, 1, "Flatten")
        }
        update() {
            super.updateInputLabels();
            let inputElems = this.getNodeInputElements();
            let hasInput = false;
            for (let input of inputElems) {
                hasInput = true;

                let inDims = (input as HTMLElement).innerText.split(SIZE_SEP).map(s => parseInt(s));
                let mult = 1;
                for (let d of inDims) {
                    mult *= d;
                }
                this.getNodeOutputElement("output_1").innerText = String(mult);
            }
            if (!hasInput)
                this.getNodeOutputElement("output_1").innerText = "";

            super.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.dim = [parseInt(this.getNodeOutputElement("output_1").innerText)];
            state.type = "flatten";
            return state;
        }
        setState(state) {
            super.setState(state);
        }
    }

    class ConcatLayer extends DynamicInputLayer {
        constructor() {
            super(1, "Concatination")
        }
        getState() {
            let state = super.getState();
            state.type = "concat";
            return state;
        }
        setState(state) {
            super.setState(state);
        }
        getOutputDim() {
            let out: NonEmptyArray<number> = [0]
            for (let input of this.getNodeInputElements()) {
                if ((input as HTMLElement).innerText != "") {
                    let dims = (input as HTMLElement).innerText.split(SIZE_SEP).map(v => parseInt(v))
                    dims = dims.filter(d => !isNaN(d));
                    let valid = out.length == dims.length;
                    for (let d = 0; d < dims.length - 1; d++) {
                        if (out[d] != dims[d])
                            valid = false;
                    }
                    if (valid) {
                        out[out.length - 1] += dims[out.length - 1];
                    } else {
                        (input as HTMLElement).innerText = out.join(SIZE_SEP);
                    }
                }
            }
            return [out];
        }
    }

    class DeConcatLayer extends Layer {
        constructor() {
            super(1, 1, "Unpacking")
        }
        update() {
            this.updateInputLabels();
            let inputText = this.getNodeInputElement("input_1").innerText
            let outputElements = this.getNodeOutputElements();
            let outputs: Record<string, DrawflowConnectionDetail[]> = {}
            for (let i = 1; i <= outputElements.length; i++) {
                outputs["output_" + i] = this.getNode().outputs["output_" + i].connections
            }
            this.removeOutputs();
            let dim = inputText.split(SIZE_SEP);
            let lastDim = parseInt(dim[dim.length - 1]);
            for (let d = 1; d <= lastDim; d++) {
                this.addOutput();
                let output = this.getNodeOutputElement("output_" + d);
                let data = dim.slice(0, dim.length - 1).map(s => parseInt(s));
                if (data.length == 0)
                    data = [1];
                output.innerText = data.join(SIZE_SEP);

                let connections = outputs["output_" + d];
                if (connections != null)
                    for (let connection of connections)
                        editor.addConnection(this.id, connection.node, "output_" + d, connection.output);
            }
            this.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.type = "deconcat";
            state.dim = [1];
            return state;
        }
        setState(state) {
            super.setState(state);
        }
    }

    class ActivationLayer extends Layer {
        private typeSelect: HTMLSelectElement;

        constructor() {
            super(1, 1, "Activation")

            let possibleActivations = ["Identity", "ReLU", "tanh", "sigmoid", "Softmax"]
            this.typeSelect = document.createElement("select");
            for (let act of possibleActivations) {
                let option = document.createElement("option");
                option.value = act;
                option.innerText = act;
                this.typeSelect.append(option)
            }
            this.elem.append(wrapWithLabel(this.typeSelect, "Function"));
        }
        update() {
            this.updateInputLabels();
            this.getNodeOutputElement("output_1").innerText = this.getNodeInputElement("input_1").innerText;
            this.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.type = "activation";
            state.dim = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(v => parseInt(v));
            state.act = this.typeSelect.value;
            return state;
        }
        setState(state) {
            super.setState(state);
            this.typeSelect.value = state.act;
        }
    }

    class MultiInputLayer extends Layer {
        private fields: TransformedDataset;

        constructor(fields) {
            super(0, Object.keys(fields.featureMaps).length, "Input")
            this.fields = fields;
            this.getNodeElement().classList.add("multi-input");
            this.getNodeElement().style.minHeight = this.getNodeElement().clientHeight + 50 + "px"

            let i = 1;
            for (let field in this.fields.featureMaps) {
                this.getNodeOutputElement("output_" + i).innerText = this.fields.featureMaps[field].size().join(SIZE_SEP);
                let p = document.createElement("p");
                p.style.position = "absolute";
                p.innerHTML = field;
                this.elem.append(p);
                p.style.width = "100px";
                p.style.textAlign = "right"
                let outputDiv: HTMLDivElement = this.getNodeOutputElement("output_" + i) as HTMLDivElement;
                p.style.top = (outputDiv.offsetTop - p.clientHeight / 2 + outputDiv.clientHeight / 2) + "px";
                i++;
            }
        }
        update() {
            this.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.type = "multi-input";
            state.outputs = {}
            let i = 1;
            for (let field in this.fields.featureMaps) {
                state.outputs["output_" + i] = field;
                i++;
            }
            state.dim = [1];
            return state;
        }
        setState(state) {
            super.setState(state);
        }
    }
    class AccessPoint extends Layer {
        private access: string;

        constructor() {
            super(1, 1, "Access")

            this.access = "access1";
        }
        update() {
            this.updateInputLabels();
            this.getNodeOutputElement("output_1").innerText = this.getNodeInputElement("input_1").innerText;
            this.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.type = "access";
            state.dim = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(v => parseInt(v));
            state.access = this.access;
            return state;
        }
        setState(state) {
            super.setState(state);
            this.access = state.access;
        }
    }
    class ProbabalisticLayer extends Layer {
        constructor() {
            super(2, 1, "Probabalistic")
        }
        update() {
            this.updateInputLabels();
            this.getNodeOutputElement("output_1").innerText = this.getNodeInputElement("input_1").innerText;
            this.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.type = "probabalistic";
            state.dim = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(v => parseInt(v));
            return state;
        }
        setState(state) {
            super.setState(state);
        }
    }
    class DropoutLayer extends Layer {
        private rate: HTMLInputElement;
        private value: HTMLInputElement;

        constructor() {
            super(1, 1, "Dropout")

            this.rate = document.createElement("input");
            this.rate.min = "0";
            this.rate.max = "1";
            this.rate.value = "0.01";
            this.elem.append(wrapWithLabel(this.rate, "Dropout Rate"));

            this.value = document.createElement("input");
            this.value.min = "-1";
            this.value.max = "1";
            this.value.value = "0";
            this.elem.append(wrapWithLabel(this.value, "Replaced Value"));
        }
        update() {
            this.updateInputLabels();
            this.getNodeOutputElement("output_1").innerText = this.getNodeInputElement("input_1").innerText;
            this.notifyOutputChange();
        }
        getState() {
            let state = super.getState();
            state.type = "dropout";
            state.dim = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(v => parseInt(v));
            state.rate = parseFloat(this.rate.value);
            state.value = parseFloat(this.value.value);
            return state;
        }
        setState(state) {
            super.setState(state);
            this.rate.value = state.rate;
            this.value.value = state.value;
        }
    }

    class AddLayer extends DynamicInputLayer {
        constructor() {
            super(1, "Elementwise Add")
        }
        update() {
            this.updateInputLabels();
            this.cleanEmptyInputs();
            if (!this.hasFreeInput())
                this.addInput();

            let dim = this.getOutputDim();
            this.getNodeOutputElement("output_1").innerHTML = dim.join(SIZE_SEP);
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
                    editor.removeNodeInput(this.getNode().id, input.classList.value.split(" ")[1])
            }
            return hasFreeInput;
        }
        getState() {
            let state = super.getState();
            state.type = "add";
            state.dim = this.getOutputDim();
            return state;
        }
        setState(state) {
            super.setState(state);
        }
        getOutputDim() {
            let out = (this.getNodeInputElements()[0] as HTMLElement).innerText.split(SIZE_SEP).map(v => parseInt(v));
            for (let input of this.getNodeInputElements()) {
                (input as HTMLElement).innerHTML = out.join(SIZE_SEP);
            }
            if (out.length == 0)
                out = [0];
            return [out as NonEmptyArray<number>];
        }
    }

    return {
        Layer, InputLayer, OutputLayer, FCLLayer, FlattenLayer, ConcatLayer, DeConcatLayer, ActivationLayer, MultiInputLayer, AccessPoint, ProbabalisticLayer, DropoutLayer, AddLayer,
        editor, getAveragePosition: function () {
            let pos: { x: number, y: number } = { x: 0, y: 0 };
            let count = 0;
            for (let layer of Object.values(LAYERS)) {
                pos.x += layer.getNode().pos_x;
                pos.y += layer.getNode().pos_y;
                count++;
            }
            if (count > 0) {
                pos.x /= count;
                pos.y /= count;
            }
            return pos;
        },
        getNumberOfParameters: function () {
            let sum = 0;
            Object.values(LAYERS).forEach(element => {
                sum += element.getNumberOfParameters();
            });
            return sum;
        },
        getNumberOfOperations: function () {
            return Object.values(LAYERS).filter(l => ["Input", "Output"].indexOf(l.type) == -1).length;
        },
        export: function () {
            let layers = Object.values(LAYERS).map(value => value.getState()).sort((a, b) => a.id - b.id)
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
        },
        import: function (layers, fields) {
            let createdLayers = [];
            layers = layers.sort(function (a, b) {
                return parseInt(a.id) - parseInt(b.id);
            })
            for (let layer of layers) {
                let createdLayer = null;
                switch (layer.type) {
                    case "input": createdLayer = new InputLayer(fields); break;
                    case "output": createdLayer = new OutputLayer(fields); break;
                    case "fcl": createdLayer = new FCLLayer(); break;
                    case "flatten": createdLayer = new FlattenLayer(); break;
                    case "concat": createdLayer = new ConcatLayer(); break;
                    case "activation": createdLayer = new ActivationLayer(); break;
                    case "multi-input": createdLayer = new MultiInputLayer(fields); break;
                    case "deconcat": createdLayer = new DeConcatLayer(); break;
                    case "access": createdLayer = new AccessPoint(); break;
                    case "probabalistic": createdLayer = new ProbabalisticLayer(); break;
                    case "dropout": createdLayer = new DropoutLayer(); break;
                    case "add": createdLayer = new AddLayer(); break;
                }
                createdLayer.setState(layer);
                createdLayers.push(createdLayer);
            }
            setTimeout(function () {
                for (let layer of layers) {
                    for (let input in layer.inputConnections) {
                        let connection = layer.inputConnections[input];
                        if (connection != null) {
                            editor.addConnection(connection.node, layer.id, connection.input, input)
                        }
                    }
                }
                for (let layer of createdLayers)
                    if (layer.type == "input")
                        layer.update();
            }, 100)
        }
    }
}