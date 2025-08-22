import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";


export class ExportLayer extends Layer {
    private fields: TransformedDataset;
    private select: SlSelect;
    private loss: SlSelect;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 0, "Output", editor)
        this.fields = fields;
        this.select = this.addSelect("Output", Object.keys(this.fields.featureMaps))

        this.loss = this.addSelect("Loss Function", ["BCE", "MAE", "MSE", "Huber","Difference","WL","CosDist"])

        let that = this;
        this.select.addEventListener("sl-change", function () {
            that.getNodeInputElement("input_1").innerText = that.fields.featureMaps[that.select.value as string].size().join(SIZE_SEP);
            that.update()
        });
    }
    update() {
        this.getNodeInputElement("input_1").innerText = this.fields.featureMaps[this.select.value as string].size().join(SIZE_SEP);
        super.checkInputs();
    }
    getState() {
        let state = super.getState();
        state.select = this.select.value;
        state.type = "output";
        state.loss = this.loss.value;
        return state;
    }
    setState(state: Record<string, any>) {
        super.setState(state);
        this.select.value = state.select;
        this.loss.value = state.loss;
        this.select.dispatchEvent(new Event('sl-change', { bubbles: true }))
    }

    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return null;
    }
}