import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";

export class ExportLayer extends Layer {
    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Flatten", editor)
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
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return { output_1: tf.layers.flatten().apply(inputs.input_1) as tf.SymbolicTensor };
    }
}