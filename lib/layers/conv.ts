import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";

import getTF from "../../lib/tflib";
import type * as TF from "@tensorflow/tfjs";
let tf: typeof import("/home/spakkel/Dokumente/ai-blocks/node_modules/@tensorflow/tfjs");
(async () => {tf = await getTF()})()
    
export class ExportLayer extends Layer {
    private kernelInput: SlInput;
    private strideInput: SlInput;
    private kernelNumInput: SlInput;
    private params: HTMLElement;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Convolution", editor)

        let that = this;
        this.kernelInput = this.addNumberInput("Kernel Size", 1, 9);
        this.kernelInput.value = "3";

        this.strideInput = this.addNumberInput("Stride", 1, 7);
        this.strideInput.onchange = function () {
            that.update();
            that.notifyOutputChange();
        }
        this.strideInput.value = "2";

        this.kernelNumInput = this.addNumberInput("# of Kernels", 1, 10);
        this.kernelNumInput.onchange = function () {
            that.update();
            that.notifyOutputChange();
        }
        this.kernelNumInput.value = "4";

        this.params = document.createElement("span");
        this.addTextElement("Parameters: ", this.params);
    }
    public getNumberOfParameters() {
        this.update();
        return parseInt(this.params.innerText);
    }
    update() {
        this.updateInputLabels();
        let numKernels = parseInt(this.kernelNumInput.value)
        let inDims = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(s => parseInt(s));
        let params = parseInt(this.kernelInput.value) ** 2 * inDims[2] * numKernels + numKernels
        this.params.innerText = String(params);
        this.getNodeOutputElement("output_1").innerText = [Math.ceil(inDims[0] / parseInt(this.strideInput.value)), Math.ceil(inDims[1] / parseInt(this.strideInput.value)), numKernels].join(SIZE_SEP)
        this.notifyOutputChange();
    }
    valid() {
        let numKernels = parseInt(this.kernelNumInput.value)
        let inDims = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(s => parseInt(s));
        let params = parseInt(this.kernelInput.value) ** 2 * inDims[2] * numKernels + numKernels
        this.params.title = params > this.editor.maxLayerParams ? "Layer has to many trainable parameters. Try reducing the input size or the tunable properties." : "";
        return super.valid() && params <= this.editor.maxLayerParams;
    }
    getState() {
        let state = super.getState();
        state.kernel = this.kernelInput.value;
        state.stride = this.strideInput.value;
        state.numkernels = this.kernelNumInput.value;
        state.type = "conv";
        return state;
    }
    setState(state) {
        super.setState(state);
        this.kernelInput.value = state.kernel;
        this.strideInput.value = state.stride;
        this.strideInput.onchange(null);
        this.kernelNumInput.value = state.numkernels;
        this.kernelNumInput.onchange(null);
    }
    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        return { output_1: tf.layers.conv2d({ filters:parseInt(this.kernelNumInput.value), kernelSize:parseInt(this.kernelInput.value), strides:parseInt(this.strideInput.value) , padding:"same"}).apply(inputs.input_1) as TF.SymbolicTensor };
    }
}