import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";
    
export class ExportLayer extends Layer {
    private strength: SlInput;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Noise", editor)

        this.strength = this.addNumberInput("Strength", 0, 1)
        this.strength.step = 0.01;
    }
    update() {
        this.updateInputLabels();
        this.getNodeOutputElement("output_1").innerText = this.getNodeInputElement("input_1").innerText;
        this.notifyOutputChange();
    }
    getState() {
        let state = super.getState();
        state.type = "noise";
        state.dim = this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).map(v => parseInt(v));
        state.strength = this.strength.value;
        return state;
    }
    setState(state) {
        super.setState(state);
        this.strength.value = state.strength;
    }
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return { output_1: tf.layers.gaussianNoise({ stddev: parseFloat(this.strength.value)}).apply(inputs.input_1) as tf.SymbolicTensor };
    }
}