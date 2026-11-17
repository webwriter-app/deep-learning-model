/** The layers of a model design, the shapes of the data between them, and the edits a design allows. No DOM, no tfjs. */

const SIZE_SEP = "×";

export type Shape = number[];
/** The shape of every feature of the dataset by its name. */
export type FeatureSizes = Record<string, Shape>;

export type LayerType =
    | "input" | "output" | "fcl" | "conv" | "transposeconv" | "activation" | "dropout" | "noise"
    | "flatten" | "reshape" | "concat" | "add" | "attention";

type Connection = { node: string; input: string };

/** A layer as it is stored in the design. The settings depend on the type. */
export interface LayerState {
    id: number;
    posX: number;
    posY: number;
    inputConnections: Record<string, Connection>;
    type: LayerType;
    valid: boolean;
    [setting: string]: unknown;
}

type Limits = { layer: number; model: number };

type PortInfo = { name: string; label: string; wired: boolean; invalid: boolean };

export type LayerInfo = {
    /** The shape of what is connected to each input port, null where nothing known is. */
    shapes: (Shape | null)[];
    output: Shape | null;
    inputs: PortInfo[];
    outputs: PortInfo[];
    /** The number of trainable parameters, if the layer has any and its input is known. */
    params: number | null;
    paramsTooMany: boolean;
    cyclic: boolean;
    /** Reshape: the number of values of the input and of the target shape, if they differ. */
    reshapeError: { from: number; to: number } | null;
    valid: boolean;
};

export type Analysis = {
    layers: Map<number, LayerInfo>;
    parameters: number;
    operations: number;
};

type Context = { layer: LayerState; inputs: (Shape | null)[]; sizes: FeatureSizes | null };

type Kind = {
    /** The number of input ports. */
    ports: (layer: LayerState) => number;
    outputs: number;
    defaults: Record<string, unknown>;
    output: (context: Context) => Shape | null;
    /** The shape each input port expects. Without it, the shape of what is connected. */
    expected?: (context: Context) => (Shape | null)[];
    params?: (context: Context) => number | null;
    /** The settings and derived values a layer stores besides its type and position. */
    store: (context: Context, output: Shape | null) => Record<string, unknown>;
};

export const LOSSES = ["BCE", "MAE", "MSE", "Huber", "Difference", "WL", "CosDist"];
export const ACTIVATIONS = ["Identity", "relu", "tanh", "sigmoid", "Softmax", "normalize"];

const integer = (value: unknown, fallback = NaN) => {
    const parsed = parseInt(String(value));
    return Number.isNaN(parsed) ? fallback : parsed;
};
const real = (value: unknown, fallback = NaN) => {
    const parsed = parseFloat(String(value));
    return Number.isNaN(parsed) ? fallback : parsed;
};
const product = (shape: Shape) => shape.reduce((a, b) => a * b, 1);
const known = (...values: (number | undefined)[]) => values.every(value => value !== undefined && !Number.isNaN(value));
const same = (a: Shape | null, b: Shape | null) => (a ? a.join(SIZE_SEP) : "") === (b ? b.join(SIZE_SEP) : "");

const shapeLabel = (shape: Shape | null | undefined) => (shape ? shape.join(SIZE_SEP) : "");

/** The number of input ports of a layer with a variable number of inputs: all connected ones and a free one. */
function dynamicPorts(layer: LayerState) {
    let highest = 0;
    for (const name of Object.keys(layer.inputConnections)) highest = Math.max(highest, integer(name.split("_")[1], 0));
    return highest + 1;
}

const fixed = (count: number) => () => count;

const settingsOf = (layer: LayerState, keys: string[]) => Object.fromEntries(keys.map(key => [key, layer[key]]));

const convSettings = (layer: LayerState) => {
    const filters = integer(layer.numkernels);
    const kernel = integer(layer.kernel);
    const stride = integer(layer.stride);
    return { filters, kernel, stride };
};

const KINDS: Record<LayerType, Kind> = {
    input: {
        ports: fixed(0), outputs: 1, defaults: { select: "" },
        output: ({ layer, sizes }) => sizes?.[String(layer.select)] ?? null,
        store: ({ layer }) => settingsOf(layer, ["select"]),
    },
    output: {
        ports: fixed(1), outputs: 0, defaults: { select: "", loss: "MSE" },
        output: () => null,
        expected: ({ layer, sizes }) => [sizes?.[String(layer.select)] ?? null],
        store: ({ layer }) => settingsOf(layer, ["select", "loss"]),
    },
    fcl: {
        ports: fixed(1), outputs: 1, defaults: { dim: 50 },
        output: ({ layer }) => [integer(layer.dim, 1)],
        params: ({ layer, inputs }) => {
            const from = inputs[0]?.[0];
            const dim = integer(layer.dim);
            return known(from, dim) ? from! * dim + dim : null;
        },
        store: ({ layer }) => ({ dim: integer(layer.dim, 1) }),
    },
    conv: {
        ports: fixed(1), outputs: 1, defaults: { kernel: "3", stride: "2", numkernels: "4" },
        output: ({ layer, inputs }) => {
            const { filters, stride } = convSettings(layer);
            const [width, height] = inputs[0] ?? [];
            return known(width, height, filters, stride) ? [Math.ceil(width / stride), Math.ceil(height / stride), filters] : null;
        },
        params: ({ layer, inputs }) => {
            const { filters, kernel } = convSettings(layer);
            const channels = inputs[0]?.[2];
            return known(channels, filters, kernel) ? kernel ** 2 * channels! * filters + filters : null;
        },
        store: ({ layer }) => settingsOf(layer, ["kernel", "stride", "numkernels"]),
    },
    transposeconv: {
        ports: fixed(1), outputs: 1, defaults: { kernel: "3", stride: "2", numkernels: "4" },
        output: ({ layer, inputs }) => {
            const { filters, stride } = convSettings(layer);
            const [width, height] = inputs[0] ?? [];
            return known(width, height, filters, stride) ? [Math.ceil(width * stride), Math.ceil(height * stride), filters] : null;
        },
        params: ({ layer }) => {
            const { filters, kernel } = convSettings(layer);
            return known(filters, kernel) ? kernel ** 2 * filters + filters : null;
        },
        store: ({ layer }) => settingsOf(layer, ["kernel", "stride", "numkernels"]),
    },
    activation: {
        ports: fixed(1), outputs: 1, defaults: { act: "relu" },
        output: ({ inputs }) => inputs[0],
        store: ({ layer, inputs }) => ({ dim: inputs[0] ?? [], act: layer.act }),
    },
    dropout: {
        ports: fixed(1), outputs: 1, defaults: { rate: 0.1 },
        output: ({ inputs }) => inputs[0],
        store: ({ layer, inputs }) => ({ dim: inputs[0] ?? [], rate: real(layer.rate, 0) }),
    },
    noise: {
        ports: fixed(1), outputs: 1, defaults: { strength: "0.2" },
        output: ({ inputs }) => inputs[0],
        store: ({ layer, inputs }) => ({ dim: inputs[0] ?? [], strength: layer.strength }),
    },
    flatten: {
        ports: fixed(1), outputs: 1, defaults: {},
        output: ({ inputs }) => (inputs[0] ? [product(inputs[0])] : null),
        store: (_, output) => ({ dim: output ?? [] }),
    },
    reshape: {
        ports: fixed(1), outputs: 1, defaults: { shape: ["1", "1", "1"] },
        output: ({ layer }) => {
            const dims = reshapeDims(layer);
            return dims.length ? dims : null;
        },
        store: ({ layer }) => ({ shape: reshapeValues(layer) }),
    },
    concat: {
        ports: dynamicPorts, outputs: 1, defaults: {},
        output: context => concatenate(context).output,
        expected: context => concatenate(context).expected,
        store: ({ layer, inputs }, output) => ({ numberOfInputs: Math.max(inputs.length, dynamicPorts(layer)), dim: [output ?? []] }),
    },
    add: {
        ports: dynamicPorts, outputs: 1, defaults: {},
        output: ({ inputs }) => inputs[0] ?? null,
        expected: ({ inputs }) => inputs.map((_, index) => (index < inputs.length - 1 ? inputs[0] : null)),
        store: ({ layer, inputs }, output) => ({ numberOfInputs: Math.max(inputs.length, dynamicPorts(layer)), dim: [output ?? []] }),
    },
    attention: {
        ports: fixed(3), outputs: 1, defaults: {},
        output: ({ inputs }) => {
            const rows = inputs[0]?.[0];
            const columns = inputs[2]?.[1];
            return known(rows, columns) ? [rows!, columns!] : null;
        },
        store: () => ({}),
    },
};

/** The dimensions a reshape layer asks for: the settings above zero. */
export function reshapeDims(layer: LayerState): Shape {
    return reshapeValues(layer).map(value => integer(value, 0)).filter(value => value > 0);
}

function reshapeValues(layer: LayerState): string[] {
    const values = Array.isArray(layer.shape) ? layer.shape : [];
    return [0, 1, 2].map(index => String(values[index] ?? "1"));
}

/**
 * Concatenation along the last axis: the first input sets the shape, every later input has
 * to agree in all dimensions but the last. An input that does not agree expects the shape so far.
 */
function concatenate({ inputs }: Context) {
    let output: Shape | null = null;
    const expected = inputs.map(shape => {
        if (!shape) return null;
        if (!output) {
            output = [...shape];
            return shape;
        }
        const fits = shape.length === output.length && shape.slice(0, -1).every((dim, index) => dim === output![index]);
        if (!fits) return [...output];
        output[output.length - 1] += shape[shape.length - 1];
        return shape;
    });
    return { output: output as Shape | null, expected };
}

/** The names of the input ports of a layer, in order. */
export function inputPorts(layer: LayerState): string[] {
    return Array.from({ length: KINDS[layer.type]?.ports(layer) ?? 0 }, (_, index) => `input_${index + 1}`);
}

function hasOutput(layer: LayerState) {
    return (KINDS[layer.type]?.outputs ?? 0) > 0;
}

function isLayerType(type: unknown): type is LayerType {
    return typeof type === "string" && Object.hasOwn(KINDS, type);
}

/**
 * Works out the shape at every port, the parameters, and what is wrong. Layers that
 * reach themselves through their own inputs are marked cyclic and have no shape.
 */
export function analyze(layers: LayerState[], sizes: FeatureSizes | null, limits: Limits): Analysis {
    const byId = new Map(layers.map(layer => [String(layer.id), layer]));
    const outputs = new Map<LayerState, Shape | null>();
    const cyclic = new Set<LayerState>();
    const path: LayerState[] = [];

    const connected = (layer: LayerState, port: string): LayerState | null => {
        const connection = layer.inputConnections[port];
        return connection ? byId.get(String(connection.node)) ?? null : null;
    };
    const inputShapes = (layer: LayerState) => inputPorts(layer).map(port => {
        const source = connected(layer, port);
        return source ? outputOf(source) : null;
    });
    const outputOf = (layer: LayerState): Shape | null => {
        if (outputs.has(layer)) return outputs.get(layer)!;
        if (path.includes(layer)) {
            for (const member of path.slice(path.indexOf(layer))) cyclic.add(member);
            return null;
        }
        path.push(layer);
        const kind = KINDS[layer.type];
        const shape = kind ? kind.output({ layer, inputs: inputShapes(layer), sizes }) : null;
        path.pop();
        if (!cyclic.has(layer)) outputs.set(layer, shape);
        return cyclic.has(layer) ? null : shape;
    };

    for (const layer of layers) outputOf(layer);

    const infos = new Map<number, LayerInfo>();
    let parameters = 0;
    let operations = 0;
    for (const layer of layers) {
        const kind = KINDS[layer.type];
        if (!kind) continue;
        const context: Context = { layer, inputs: inputShapes(layer), sizes };
        const expected = kind.expected ? kind.expected(context) : context.inputs;
        const ports = inputPorts(layer);
        const inputs = ports.map((name, index) => {
            const label = shapeLabel(expected[index]);
            const wired = connected(layer, name) !== null;
            return { name, label, wired, invalid: wired && label !== "" && !same(expected[index] ?? null, context.inputs[index]) };
        });
        const output = cyclic.has(layer) ? null : outputs.get(layer) ?? null;
        const params = kind.params ? kind.params(context) : null;
        const paramsTooMany = params !== null && params > limits.layer;
        const reshapeError = layer.type === "reshape" && context.inputs[0] && product(context.inputs[0]) !== product(reshapeDims(layer))
            ? { from: product(context.inputs[0]), to: product(reshapeDims(layer)) } : null;
        const needsParams = kind.params !== undefined && layer.type !== "transposeconv";
        const valid = inputs.every(port => !port.invalid) && !cyclic.has(layer) && !paramsTooMany && !reshapeError && !(needsParams && params === null);
        infos.set(layer.id, {
            shapes: context.inputs, output,
            inputs,
            outputs: kind.outputs ? [{ name: "output_1", label: shapeLabel(output), wired: false, invalid: false }] : [],
            params, paramsTooMany, cyclic: cyclic.has(layer), reshapeError, valid,
        });
        if (params !== null) parameters += params;
        if (layer.type !== "input" && layer.type !== "output") operations++;
    }
    return { layers: infos, parameters, operations };
}

/** The new state of a layer of a type, with its default settings. */
export function newLayer(layers: LayerState[], type: LayerType, at: { x: number; y: number }): LayerState {
    return {
        id: Math.max(0, ...layers.map(layer => layer.id)) + 1,
        posX: Math.round(at.x), posY: Math.round(at.y),
        inputConnections: {}, type, valid: true,
        ...structuredClone(KINDS[type].defaults),
    };
}

/** The layers of a stored design. Entries that are no layer are left out, missing fields get defaults. */
export function importLayers(design: unknown): LayerState[] {
    if (!Array.isArray(design)) return [];
    return design.filter(entry => entry && typeof entry === "object" && isLayerType(entry.type)).map(entry => ({
        ...structuredClone(KINDS[entry.type as LayerType].defaults),
        ...entry,
        id: integer(entry.id, 0),
        posX: real(entry.posX, 0),
        posY: real(entry.posY, 0),
        inputConnections: entry.inputConnections && typeof entry.inputConnections === "object" ? { ...entry.inputConnections } : {},
        valid: entry.valid !== false,
    }));
}

/** The design as it is stored: layers in the order of their ids, renumbered from 1, with the derived values. */
export function exportLayers(layers: LayerState[], sizes: FeatureSizes | null, limits: Limits): LayerState[] {
    const sorted = [...layers].sort((a, b) => a.id - b.id);
    const renumbered = new Map(sorted.map((layer, index) => [String(layer.id), String(index + 1)]));
    const analysis = analyze(sorted, sizes, limits);
    return sorted.map((layer, index) => {
        const connections: Record<string, Connection> = {};
        for (const [port, connection] of Object.entries(layer.inputConnections)) {
            const node = renumbered.get(String(connection.node));
            if (node !== undefined) connections[port] = { node, input: connection.input };
        }
        const info = analysis.layers.get(layer.id)!;
        return {
            id: index + 1,
            posX: Math.round(layer.posX), posY: Math.round(layer.posY),
            inputConnections: connections,
            type: layer.type,
            valid: info.valid,
            ...KINDS[layer.type].store({ layer, inputs: info.shapes, sizes }, info.output),
        };
    });
}

/** Moves layers to new positions. */
export function moveLayers(layers: LayerState[], moves: { id: number; x: number; y: number }[]): LayerState[] {
    const to = new Map(moves.map(move => [move.id, move]));
    return layers.map(layer => {
        const move = to.get(layer.id);
        return move ? { ...layer, posX: Math.round(move.x), posY: Math.round(move.y) } : layer;
    });
}

/** Changes settings of one layer. */
export function changeLayer(layers: LayerState[], id: number, settings: Record<string, unknown>): LayerState[] {
    return layers.map(layer => (layer.id === id ? { ...layer, ...settings } : layer));
}

/** Keeps the ports of a variable layer without gaps, in the order they had. */
function compact(layer: LayerState): LayerState {
    if (KINDS[layer.type].ports !== dynamicPorts) return layer;
    const ordered = Object.entries(layer.inputConnections).sort(([a], [b]) => integer(a.split("_")[1]) - integer(b.split("_")[1]));
    return { ...layer, inputConnections: Object.fromEntries(ordered.map(([, connection], index) => [`input_${index + 1}`, connection])) };
}

/**
 * Connects the output of one layer to an input port of another. Returns null where the design
 * does not allow it: a layer to itself, a layer without that port, an input that is taken.
 */
export function connectLayers(layers: LayerState[], from: number, to: number, port: string): LayerState[] | null {
    const source = layers.find(layer => layer.id === from);
    const target = layers.find(layer => layer.id === to);
    if (!source || !target || from === to || !hasOutput(source) || !inputPorts(target).includes(port) || target.inputConnections[port]) return null;
    return layers.map(layer => (layer === target
        ? { ...layer, inputConnections: { ...layer.inputConnections, [port]: { node: String(from), input: "output_1" } } }
        : layer));
}

/** Removes the connection into an input port. */
export function disconnectLayers(layers: LayerState[], to: number, port: string): LayerState[] {
    return layers.map(layer => {
        if (layer.id !== to || !layer.inputConnections[port]) return layer;
        const { [port]: _removed, ...rest } = layer.inputConnections;
        return compact({ ...layer, inputConnections: rest });
    });
}

/** Removes layers and every connection that came from them. */
export function removeLayers(layers: LayerState[], ids: number[]): LayerState[] {
    const gone = new Set(ids.map(String));
    return layers.filter(layer => !ids.includes(layer.id)).map(layer => {
        if (!Object.values(layer.inputConnections).some(connection => gone.has(String(connection.node)))) return layer;
        const rest = Object.fromEntries(Object.entries(layer.inputConnections).filter(([, connection]) => !gone.has(String(connection.node))));
        return compact({ ...layer, inputConnections: rest });
    });
}

/** The size of each feature of a dataset. */
export function featureSizes(dataset: { featureMaps: Record<string, { size(): number[] }> } | null | undefined): FeatureSizes | null {
    if (!dataset) return null;
    return Object.fromEntries(Object.entries(dataset.featureMaps).map(([name, feature]) => [name, [...feature.size()]]));
}

export { integer as parseInteger, real as parseReal };
