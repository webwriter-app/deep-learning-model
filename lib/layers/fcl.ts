import { SlInput } from "@shoelace-style/shoelace";
import { TransformedDataset } from '../dataset/dataset';
import { Editor, Layer } from "./index";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export class ExportLayer extends Layer {
    private dimInput: SlInput;
    private params: HTMLElement;

    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, 1, "Linear", editor)

        this.dimInput = this.addNumberInput(() => this.editor.msg("Output Nodes"), 1, 500);
        let that = this;
        this.dimInput.oninput = function () {
            that.getNodeOutputElement("output_1").innerText = that.dimInput.value;
            that.update();
            that.notifyOutputChange();
        }
        this.dimInput.value = "50"

        this.params = document.createElement("span");
        this.addTextElement(() => this.editor.msg("Parameters: "), this.params);
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
    valid() {
        let inDim = parseInt(this.getNodeInputElement("input_1").innerText)
        let outDim = parseInt(this.dimInput.value)
        let params = inDim * outDim + outDim
        this.params.title = params > this.editor.maxLayerParams ? this.editor.msg("Layer has to many trainable parameters. Try reducing the input size or the tunable properties.") : "";
        return super.valid() && params <= this.editor.maxLayerParams;
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
    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        return { output_1: tf.layers.dense({ units: parseInt(this.dimInput.value) }).apply(inputs.input_1) as TF.SymbolicTensor };
    }
    protected getDisplayName(): string {
        return this.editor.msg("Linear");
    }
}