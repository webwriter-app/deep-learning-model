import {DynamicInputLayer, Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";

import getTF from "../../lib/tflib";
import type * as TF from "@tensorflow/tfjs";
let tf: typeof TF;
(async () => {tf = await getTF()})()

type NonEmptyArray<T> = [T, ...T[]];
    
export class ExportLayer extends DynamicInputLayer {
    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, "Elementwise Add", editor)
    }
    getOutputDim() {
        let out = (this.getNodeInputElements()[0] as HTMLElement).innerText.split(SIZE_SEP).map(v => parseInt(v));
        let i = 1;
        for (let input of this.getNodeInputElements()) {
            this.getNode().inputs
            if (i >= Object.keys(this.getNode().inputs).length)
                break;
            (input as HTMLElement).innerHTML = out.join(SIZE_SEP);
            i++;
        }
        if (out.length == 0)
            out = [0];
        return [out as NonEmptyArray<number>];
    }
    update() {
        super.update();
        this.checkInputs();
    }
    getState() {
        let state = super.getState();
        state.type = "add";
        return state;
    }
    setState(state) {
        super.setState(state);
    }
    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        if (Object.keys(inputs).length == 1)
            return { output_1: inputs.input_1 as TF.SymbolicTensor }
        return { output_1: tf.layers.add().apply(Object.values(inputs)) as TF.SymbolicTensor };
    }
}