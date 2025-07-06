import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../types/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";

type ActivationIdentifier = 'elu'|'hardSigmoid'|'linear'|'relu'|'relu6'|'selu'|'sigmoid'|'softmax'|'softplus'|'softsign'|'tanh'|'swish'|'mish'|'gelu'|'gelu_new';
    
export class ExportLayer extends Layer {
    private typeSelect: SlSelect;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Activation", editor)

        this.typeSelect = this.addSelect("Function", ["Identity", "ReLU", "tanh", "sigmoid", "Softmax", "normalize"])
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
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        if (this.typeSelect.value == "Identity")
            return { output_1: inputs.input_1};
        else if (this.typeSelect.value == "normalize")
            return { output_1: tf.layers.layerNormalization().apply(inputs.input_1) as tf.SymbolicTensor};
        else return { output_1: tf.layers.activation({ activation: this.typeSelect.value as ActivationIdentifier}).apply(inputs.input_1) as tf.SymbolicTensor };
    }
}
