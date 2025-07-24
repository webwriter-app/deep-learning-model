import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";


export class ExportLayer extends Layer {
    private fields: TransformedDataset;
    private select: SlSelect;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(0, 1, "Input", editor)
        this.fields = fields;
        this.select = this.addSelect("Input field", Object.keys(this.fields.featureMaps))

        let that = this;
        this.select.addEventListener("sl-change", function () {
            that.getNodeOutputElement("output_1").innerText = fields.featureMaps[(that.select.value as string).replaceAll("_"," ")].size().join(SIZE_SEP);
            that.update();
        });
    }
    update() {
        super.notifyOutputChange();
    }
    getState() {
        let state = super.getState();
        state.select = this.select.value;
        state.type = "input";
        return state;
    }
    setState(state) {
        super.setState(state);
        this.select.value = state.select;
        this.select.dispatchEvent(new Event('sl-change', { bubbles: true }))
    }
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return {output_1: inputs[this.select.value as string] };
    }
}