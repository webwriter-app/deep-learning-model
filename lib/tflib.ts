/** Weird workaround with a dynamic import in order to only import tf once. */
export default function getTF(): Promise<typeof import("@tensorflow/tfjs")> {
    const w = window as any;
    if (w.__TFPromise == null) {
        w.__TFPromise = w.TF != null
            ? Promise.resolve(w.TF)
            : import("@tensorflow/tfjs").then(tf => (w.TF = tf));
    }
    return w.__TFPromise;
}
