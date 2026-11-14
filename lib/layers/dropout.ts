import { SlInput } from "@shoelace-style/shoelace";
import { TransformedDataset } from '../dataset/dataset';
import { Editor, Layer, SIZE_SEP } from "./index";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()
    
export class ExportLayer extends Layer {
    private rate: SlInput;
    private value: SlInput;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Dropout", editor)

        this.rate = this.addNumberInput(() => this.editor.msg("Rate"), 0, 1);
        this.rate.value = "0.1";
        this.rate.step = 0.05;
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
        return state;
    }
    setState(state) {
        super.setState(state);
        this.rate.value = state.rate;
    }
    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        return { output_1: tf.layers.dropout({rate: parseFloat(this.rate.value) }).apply(inputs.input_1) as TF.SymbolicTensor };
    }
    protected getDisplayName(): string {
        return this.editor.msg("Dropout");
    }
}