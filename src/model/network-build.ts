/** Turns a model design into a tfjs model. */
import type * as TF from "@tensorflow/tfjs";
import { inputPorts, parseInteger, parseReal, reshapeDims, type LayerState } from "./network";
import getTF from "./tflib";
import { createNoOpLayer, lossStringToFunction, type LossFn } from "./training";

const tf = await getTF();

type Tensors = Record<string, TF.SymbolicTensor>;
type ActivationIdentifier = "elu" | "hardSigmoid" | "linear" | "relu" | "relu6" | "selu" | "sigmoid" | "softmax" | "softplus" | "softsign" | "tanh" | "swish" | "mish" | "gelu" | "gelu_new";

/** The NoOpLayer names an output, which later widgets read to connect the model output to the dataset labels. */
export const NoOpLayer = createNoOpLayer(tf);

function scaledDotProductAttention(q: TF.Tensor, k: TF.Tensor, v: TF.Tensor) {
    const scores = tf.div(tf.matMul(q, k, false, true), tf.sqrt(tf.scalar(q.shape[q.shape.length - 1], "float32")));
    return tf.matMul(tf.softmax(scores, -1), v);
}

class AttentionLayer extends tf.layers.Layer {
    static className = "AttentionLayer";

    constructor(config: ConstructorParameters<typeof TF.layers.Layer>[0]) {
        super(config);
        this.supportsMasking = true;
    }

    call(inputs: TF.Tensor | TF.Tensor[]) {
        const [q, k, v] = inputs as TF.Tensor[];
        return scaledDotProductAttention(q, k, v);
    }

    computeOutputShape(inputShape: TF.Shape | TF.Shape[]) {
        return (inputShape as TF.Shape[])[0];
    }
}
tf.serialization.registerClass(AttentionLayer as TF.serialization.SerializableConstructor<TF.layers.Layer>);

const symbolic = (tensor: unknown) => tensor as TF.SymbolicTensor;

/** The tfjs operation of each layer type. The inputs are named like the input ports. */
const FORWARD: Record<string, (layer: LayerState, inputs: Tensors) => TF.SymbolicTensor> = {
    input: (layer, inputs) => inputs[String(layer.select)],
    fcl: (layer, inputs) => symbolic(tf.layers.dense({ units: parseInteger(layer.dim) }).apply(inputs.input_1)),
    conv: (layer, inputs) => symbolic(tf.layers.conv2d({ filters: parseInteger(layer.numkernels), kernelSize: parseInteger(layer.kernel), strides: parseInteger(layer.stride), padding: "same" }).apply(inputs.input_1)),
    transposeconv: (layer, inputs) => symbolic(tf.layers.conv2dTranspose({ filters: parseInteger(layer.numkernels), kernelSize: parseInteger(layer.kernel), strides: parseInteger(layer.stride), padding: "same" }).apply(inputs.input_1)),
    activation: (layer, inputs) => {
        if (layer.act === "Identity") return inputs.input_1;
        if (layer.act === "normalize") return symbolic(tf.layers.layerNormalization().apply(inputs.input_1));
        return symbolic(tf.layers.activation({ activation: layer.act as ActivationIdentifier }).apply(inputs.input_1));
    },
    dropout: (layer, inputs) => symbolic(tf.layers.dropout({ rate: parseReal(layer.rate) }).apply(inputs.input_1)),
    noise: (layer, inputs) => symbolic(tf.layers.gaussianNoise({ stddev: parseReal(layer.strength) }).apply(inputs.input_1)),
    flatten: (_, inputs) => symbolic(tf.layers.flatten().apply(inputs.input_1)),
    reshape: (layer, inputs) => symbolic(tf.layers.reshape({ targetShape: reshapeDims(layer) }).apply(inputs.input_1)),
    concat: (_, inputs) => symbolic(tf.layers.concatenate().apply(Object.values(inputs))),
    add: (_, inputs) => (Object.keys(inputs).length === 1 ? inputs.input_1 : symbolic(tf.layers.add().apply(Object.values(inputs)))),
    attention: (_, inputs) => symbolic(new AttentionLayer({}).apply(Object.values(inputs))),
};

/**
 * Connects the output layers of a design to the input tensors, named by the feature each input takes.
 * @returns The output tensors by the feature name, and the loss of each output by the name of its NoOpLayer.
 */
export function connectNetwork(layers: LayerState[], inputs: Tensors): { outputs: Tensors; losses: Record<string, LossFn> } {
    const byId = new Map(layers.map(layer => [String(layer.id), layer]));
    const resolved = new Map<LayerState, TF.SymbolicTensor>();

    const resolve = (layer: LayerState, path: LayerState[]): TF.SymbolicTensor => {
        const done = resolved.get(layer);
        if (done) return done;
        if (path.includes(layer)) throw new Error("cyclic dependency in network");
        const tensors: Tensors = layer.type === "input" ? inputs : {};
        for (const port of inputPorts(layer)) {
            const connection = layer.inputConnections[port];
            const source = connection && byId.get(String(connection.node));
            if (source) tensors[port] = resolve(source, [...path, layer]);
        }
        const tensor = FORWARD[layer.type](layer, tensors);
        resolved.set(layer, tensor);
        return tensor;
    };

    const outputs: Tensors = {};
    const losses: Record<string, LossFn> = {};
    for (const layer of layers.filter(layer => layer.type === "output")) {
        const connection = layer.inputConnections.input_1;
        const source = connection && byId.get(String(connection.node));
        if (!source) throw new Error("An output layer is not connected");
        outputs[String(layer.select)] = symbolic(new NoOpLayer({ name: `out_${layer.select}` }).apply(resolve(source, [layer])));
        losses[`out_${layer.select}`] = lossStringToFunction(tf, String(layer.loss)) as LossFn;
    }
    return { outputs, losses };
}
