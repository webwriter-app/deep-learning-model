import type * as TF from "@tensorflow/tfjs";
import type { Table } from "./dataset/table";

/** A loss function as `compile` takes it. */
export type LossFn = Extract<NonNullable<Parameters<TF.LayersModel["compile"]>[0]["loss"]>, (...args: any[]) => any>;

type NoOpLayerClass = new (config: ConstructorParameters<typeof TF.layers.Layer>[0]) => TF.layers.Layer;

export function uint8ToHex(uint8: Uint8Array) {
  return Array.from(uint8, b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToUint8(hex: string) {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const len = hex.length / 2;
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return result;
}

/**
 * The NoOpLayer is important for designating an output name. This will be read by later widgets to connect the correct model output to the dataset labels.
 * It is registered in tfjs on creation.
 */
export function createNoOpLayer(tf: typeof TF): NoOpLayerClass {
  class NoOpLayer extends tf.layers.Layer {
    constructor(config: ConstructorParameters<typeof TF.layers.Layer>[0]) {
      super(config);
      this.supportsMasking = true;
    }

    call(inputs: TF.Tensor | TF.Tensor[]) {
      return inputs;
    }

    computeOutputShape(inputShape: TF.Shape | TF.Shape[]) {
      return inputShape;
    }

    static get className() {
      return 'NoOpLayer';
    }
  }

  tf.serialization.registerClass(NoOpLayer as TF.serialization.SerializableConstructor<TF.layers.Layer>);
  return NoOpLayer;
}

/**
 * Converts a loss string to the corresponding tfjs loss function.
 * @param loss The loss string like "MSE" or "BCE"
 */
export function lossStringToFunction(tf: typeof TF, loss: string) {
  switch (loss) {
    case "BCE": return tf.metrics.binaryCrossentropy;
    case "MAE": return tf.metrics.meanAbsoluteError;
    case "Huber": return tf.losses.huberLoss;
    case "MSE": return tf.metrics.meanSquaredError;
    case "Difference": return tf.losses.absoluteDifference;
    case "WL": return tf.losses.computeWeightedLoss;
    case "CosDist": return tf.losses.cosineDistance;
    default: throw new Error(`Unknown loss function "${loss}"`);
  }
}

/** The metrics per epoch as a table: one column per metric, one row per epoch, the epochs counted from 1. */
export function historyTable(metrics: Record<string, number[]>): Table {
  const names = Object.keys(metrics);
  const epochs = Math.max(0, ...names.map(name => metrics[name].length));
  return {
    columns: ["epoch", ...names.map(name => name.replaceAll("_", " "))],
    rows: Array.from({ length: epochs }, (_, index) => [index + 1, ...names.map(name => metrics[name][index] ?? null)]),
  };
}

/** The last value of a column of a history table, or null. */
export function lastValue(table: Table, column: string): number | null {
  const index = table.columns.indexOf(column);
  for (let row = table.rows.length - 1; index > 0 && row >= 0; row--) {
    const value = table.rows[row][index];
    if (typeof value === "number") return value;
  }
  return null;
}

/** The checkpoint to export: the best one, else the one of the latest epoch. */
export function pickCheckpoint(names: string[]): string | null {
  if (names.includes("best")) return "best";
  const epochs = names.filter(name => /^epoch-\d+$/.test(name)).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
  return epochs.at(-1) ?? names[0] ?? null;
}
