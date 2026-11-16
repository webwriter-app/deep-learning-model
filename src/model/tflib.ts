type TFModule = typeof import("@tensorflow/tfjs");

/** Weird workaround with a dynamic import in order to only import tf once. */
export default function getTF(): Promise<TFModule> {
    const w = window as unknown as { __TFPromise?: Promise<TFModule>, TF?: TFModule };
    if (w.__TFPromise == null) {
        w.__TFPromise = w.TF != null
            ? Promise.resolve(w.TF)
            : import("@tensorflow/tfjs").then(tf => (w.TF = tf));
    }
    return w.__TFPromise;
}
