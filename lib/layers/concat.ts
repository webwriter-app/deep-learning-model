import {DynamicInputLayer, Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../types/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";
import * as tf from "@tensorflow/tfjs";

type NonEmptyArray<T> = [T, ...T[]];
    
export class ExportLayer extends DynamicInputLayer {
    constructor(fields: TransformedDataset, editor: Editor) {
        super(1, "Concatenation", editor)
    }
    getOutputDim() {
        let out: NonEmptyArray<number> = [0]
        for (let input of this.getNodeInputElements()) {
            if ((input as HTMLElement).innerText != "") {
                let dims = (input as HTMLElement).innerText.split(SIZE_SEP).map(v => parseInt(v))
                dims = dims.filter(d => !isNaN(d));
                let valid = out.length == dims.length;
                for (let d = 0; d < dims.length - 1; d++) {
                    if (out[d] != dims[d])
                        valid = false;
                }
                if (valid) {
                    out[out.length - 1] += dims[out.length - 1];
                } else {
                    (input as HTMLElement).innerText = out.join(SIZE_SEP);
                }
            }
        }
        return [out];
    }
    getState() {
        let state = super.getState();
        state.type = "concat";
        return state;
    }
    setState(state) {
        super.setState(state);
    }
    public forward(inputs: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
        return { output_1: tf.layers.concatenate().apply(Object.values(inputs)) as tf.SymbolicTensor };
    }
}