import {Editor, Layer, SIZE_SEP} from "./index";
import { TransformedDataset } from '../dataset/dataset';
import { SlInput, SlSelect } from "@shoelace-style/shoelace";

import getTF from "../../lib/tflib";
import type * as TF from "@tensorflow/tfjs";
let tf: typeof import("/home/spakkel/Dokumente/ai-blocks/node_modules/@tensorflow/tfjs");

let AttentionLayer;
(async () => {
  tf = await getTF()

  function scaledDotProductAttention(q, k, v, mask = null) {
    const matmulQK = tf.matMul(q, k, false, true);
    const dk = tf.scalar(q.shape[q.shape.length - 1], 'float32');
    const scaledScores = tf.div(matmulQK, tf.sqrt(dk));

    if (mask !== null) {
      const NEG_INF = tf.scalar(-1e9);
      const maskedScores = scaledScores.add(mask.mul(NEG_INF));
      return tf.softmax(maskedScores, -1).matMul(v); // Weighted sum
    }

    const attentionWeights = tf.softmax(scaledScores, -1);
    const output = tf.matMul(attentionWeights, v);

    return output;
  }

  AttentionLayer = class AttentionLayer extends tf.layers.Layer {
    static className = 'AttentionLayer'

    constructor(config) {
      super(config);
      this.supportsMasking = true;
    }

    call(inputs, kwargs) {
      const [q, k, v] = inputs;
      return scaledDotProductAttention(q, k, v);
    }

    computeOutputShape(inputShape) {
      return inputShape[0];
    }
  }
  tf.serialization.registerClass(AttentionLayer);
})()
    
export class ExportLayer extends Layer {
    constructor(fields: TransformedDataset, editor: Editor) {
        super(3, 1, "Attention", editor)
    }
    update() {
        this.updateInputLabels();
        let inputs = [...this.getNodeInputElements()].map(input => (input as HTMLElement).innerText.split(SIZE_SEP).map(s => parseInt(s)));
        this.getNodeOutputElement("output_1").innerText = [inputs[0][0], inputs[2][1]].join(SIZE_SEP)
        this.notifyOutputChange();
    }
    getState() {
        let state = super.getState();
        state.type = "attention";
        return state;
    }
    setState(state) {
        super.setState(state);
    }
    public forward(inputs: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
        return { output_1: new AttentionLayer({}).apply(Object.values(inputs)) as TF.SymbolicTensor };
    }
}