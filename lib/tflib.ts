/** Weird workaround with a dynamic import in order to only import tf once. */
export default async function getTF() {
    if ((window as any).TF == null)
        (window as any).TF = await import("@tensorflow/tfjs");
    return (window as any).TF as typeof import("@tensorflow/tfjs");
}