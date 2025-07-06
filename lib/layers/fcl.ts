import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../types/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";
    
export class ExportLayer extends Layer {
    private dimInput: SlInput;
    private params: HTMLElement;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Linear", editor)

        this.dimInput = this.addNumberInput("Output Nodes", 1, 300);
        let that = this;
        this.dimInput.oninput = function () {
            that.getNodeOutputElement("output_1").innerText = that.dimInput.value;
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
        let inDim = parseInt(this.getNodeInputElement("input_1").innerText)
        let outDim = parseInt(this.dimInput.value)
        this.params.innerText = String(inDim * outDim + outDim);
        this.notifyOutputChange();
    }
    getState() {
        let state = super.getState();
        state.dim = parseInt(this.dimInput.value);
        state.type = "fcl";
        return state;
    }

    setState(state) {
        super.setState(state);
        this.dimInput.value = state.dim;
        this.dimInput.oninput(null);
    }
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return { output_1: tf.layers.dense({ units: parseInt(this.dimInput.value) }).apply(inputs.input_1) as tf.SymbolicTensor };
    }
}