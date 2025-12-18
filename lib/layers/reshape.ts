import { SlInput } from "@shoelace-style/shoelace";
import { TransformedDataset } from '../dataset/dataset';
import { Editor, Layer, SIZE_SEP } from "./index";
import { msg, str } from "@lit/localize";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export class ExportLayer extends Layer {
    private shapeInputs: SlInput[] = [];
    private error: HTMLSpanElement;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Reshape", editor)

        for (let i = 0; i < 3; i++) {
            this.shapeInputs[i] = this.addNumberInput(msg(str`${(i + 1)}th dim`), 0, 9999999);
            this.shapeInputs[i].value = "1";
        }

        this.error = document.createElement("span");
        this.error.style.color="red";
        this.addTextElement("", this.error);
    }
    update() {
        this.updateInputLabels();
        let inDim = 1;
        this.getNodeInputElement("input_1").innerText.split(SIZE_SEP).forEach(v => inDim *= parseInt(v));
        let outDim = 1;
        let outputDims = [];
        for (let i = 0; i < this.shapeInputs.length; i++) {
            let value = parseInt(this.shapeInputs[i].value)
            if (value > 0) {
                outputDims.push(parseInt(this.shapeInputs[i].value));
                outDim *= value;
            }
        }
        if (inDim != outDim) {
            this.error.innerText = msg(str`Output shape invalid: ${inDim} != ${outDim}`);
        } else {
            this.error.innerText = "";
        }
        this.getNodeOutputElement("output_1").innerText = outputDims.join(SIZE_SEP)
        this.notifyOutputChange();
    }
    valid() {
        return super.valid() && this.error.innerText == "";
    }
    getState() {
        let state = super.getState();
        state.shape = this.shapeInputs.map(input => input.value)
        state.type = "reshape";
        return state;
    }

    setState(state) {
        super.setState(state);
        for (let i = 0; i < this.shapeInputs.length; i++) {
            this.shapeInputs[i].value = state.shape[i];
        }
    }
    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        let outputDims = [];
        for (let i = 0; i < this.shapeInputs.length; i++) {
            let value = parseInt(this.shapeInputs[i].value)
            if (value > 0)
                outputDims.push(parseInt(this.shapeInputs[i].value));
        }
        return { output_1: tf.layers.reshape({ targetShape: outputDims}).apply(inputs.input_1) as TF.SymbolicTensor };
    }
    protected getDisplayName(): string {
        return msg("Reshape");
    }
}