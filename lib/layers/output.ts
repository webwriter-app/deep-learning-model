import { SlSelect } from "@shoelace-style/shoelace";
import { TransformedDataset } from '../dataset/dataset';
import { Editor, Layer, SIZE_SEP } from "./index";
import { msg } from "@lit/localize";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export class ExportLayer extends Layer {
    private fields: TransformedDataset;
    private select: SlSelect;
    private loss: SlSelect;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 0, "Output", editor)
        if (fields == null) {
            let span = document.createElement("span");
            span.innerText = msg("No Feature Data avaliable");
            this.addTextElement("",span)
            return;
        }
        this.fields = fields;
        this.select = this.addSelect(msg("Output"), Object.keys(this.fields.featureMaps))
        this.select.disabled = editor.editMode != "edit";

        this.loss = this.addSelect(msg("Loss Function"), ["BCE", "MAE", "MSE", "Huber","Difference","WL","CosDist"])
        this.loss.value = "MSE";

        let that = this;
        this.select.addEventListener("sl-change", function () {
            that.getNodeInputElement("input_1").innerText = that.fields.featureMaps[that.select.value as string].size().join(SIZE_SEP);
            that.update()
        });
    }
    update() {
        if (this.fields && this.select)
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
        if (!this.select || !this.loss)
            return;
        this.select.value = state.select;
        this.loss.value = state.loss;
        this.select.dispatchEvent(new Event('sl-change', { bubbles: true }))
    }

    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        return null;
    }
    protected getDisplayName(): string {
        return msg("Output");
    }
}