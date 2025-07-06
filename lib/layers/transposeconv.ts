import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../types/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";
    
export class ExportLayer extends Layer {
    private kernelInput: SlInput;
    private strideInput: SlInput;
    private kernelNumInput: SlInput;
    private params: HTMLElement;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Transpose Convolution", editor)

        let that = this;
        this.kernelInput = this.addNumberInput("Kernel Size", 1, 9);

        this.strideInput = this.addNumberInput("Stride", 1, 7);
        this.strideInput.onchange = function () {
            that.update();
            that.notifyOutputChange();
        }

        this.kernelNumInput = this.addNumberInput("# of Kernels", 1, 20);
        this.kernelNumInput.onchange = function () {
            that.update();
            that.notifyOutputChange();
        }

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
        this.params.innerText = String(parseInt(this.kernelInput.value) ** 2 * numKernels + numKernels);
        let inDims = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(s => parseInt(s));
        let kernelSize = parseInt(this.kernelInput.value)
        this.getNodeOutputElement("output_1").innerText = [Math.ceil(inDims[0] * parseInt(this.strideInput.value)), Math.ceil(inDims[1] * parseInt(this.strideInput.value)), numKernels].join(SIZE_SEP)
        this.notifyOutputChange();
    }
    getState() {
        let state = super.getState();
        state.kernel = this.kernelInput.value;
        state.stride = this.strideInput.value;
        state.numkernels = this.kernelNumInput.value;
        state.type = "transposeconv";
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
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return { output_1: tf.layers.conv2dTranspose({ filters:parseInt(this.kernelNumInput.value), kernelSize:parseInt(this.kernelInput.value), strides:parseInt(this.strideInput.value) , padding:"same"}).apply(inputs.input_1) as tf.SymbolicTensor };
    }
}