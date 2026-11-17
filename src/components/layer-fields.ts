import { str, type MsgFn } from "@lit/localize";
import { html, nothing, type TemplateResult } from "lit";
import { ACTIVATIONS, LOSSES, parseInteger, parseReal, type FeatureSizes, type LayerInfo, type LayerState, type LayerType } from "../model/network";

/** What the fields of a layer need from the editor that shows them. */
type FieldsContext = {
    msg: MsgFn;
    editmode: string;
    sizes: FeatureSizes | null;
    change(id: number, settings: Record<string, unknown>): void;
};

type NumberField = { key: string; label: string; min: number; max: number; step?: number; float?: boolean; text?: boolean };

/** The localized name of a layer type, shown in the header of its node. */
export function layerName(type: LayerType, msg: MsgFn): string {
    const names: Record<LayerType, () => string> = {
        input: () => msg("Input"),
        output: () => msg("Output"),
        fcl: () => msg("Linear"),
        conv: () => msg("Convolution"),
        transposeconv: () => msg("Transpose Convolution"),
        activation: () => msg("Activation"),
        dropout: () => msg("Dropout"),
        noise: () => msg("Noise"),
        flatten: () => msg("Flatten"),
        concat: () => msg("Concatenation"),
        add: () => msg("Elementwise Add"),
        reshape: () => msg("Reshape"),
        attention: () => msg("Attention"),
    };
    return names[type]();
}

function numberField(context: FieldsContext, layer: LayerState, field: NumberField): TemplateResult {
    const { key, min, max } = field;
    const parse = field.float ? parseReal : parseInteger;
    const value = (event: Event) => parse((event.target as HTMLInputElement).value);
    // A value that is still being typed and out of range is left alone until the field is left.
    const live = (event: Event) => {
        const number = value(event);
        if (number >= min && number <= max) context.change(layer.id, { [key]: field.text ? String(number) : number });
    };
    const settle = (event: Event) => {
        const number = Math.min(max, Math.max(min, Number.isNaN(value(event)) ? min : value(event)));
        (event.target as HTMLInputElement).value = String(number);
        context.change(layer.id, { [key]: field.text ? String(number) : number });
    };
    return html`<sl-input type="number" size="small" label=${field.label} min=${min} step=${field.step ?? 1}
        .value=${String(layer[key])} ?disabled=${context.editmode === "read"}
        @sl-input=${live} @sl-change=${settle}></sl-input>`;
}

function selectField(context: FieldsContext, layer: LayerState, key: string, label: string, options: string[], disabled = context.editmode === "read"): TemplateResult {
    return html`<sl-select size="small" label=${label} .value=${String(layer[key] ?? "")} ?disabled=${disabled}
        @sl-change=${(event: Event) => context.change(layer.id, { [key]: (event.target as HTMLInputElement).value })}>
        ${options.map(option => html`<sl-option value=${option}>${option}</sl-option>`)}
    </sl-select>`;
}

function parameters(context: FieldsContext, info: LayerInfo): TemplateResult {
    const title = info.paramsTooMany ? context.msg("Layer has to many trainable parameters. Try reducing the input size or the tunable properties.") : "";
    return html`<p>${context.msg("Parameters: ")}<span title=${title}>${info.params ?? ""}</span></p>`;
}

const FEATURE_MISSING = (context: FieldsContext) => html`<p><span>${context.msg("No Feature Data avaliable")}</span></p>`;

/** The fields of one layer: what a reader can set on it, and what is derived from the settings. */
export function layerFields(context: FieldsContext, layer: LayerState, info: LayerInfo): TemplateResult | typeof nothing {
    const { msg, sizes } = context;
    const features = sizes ? Object.keys(sizes) : [];
    switch (layer.type) {
        case "input":
            return sizes ? selectField(context, layer, "select", msg("Input field"), features, context.editmode !== "edit") : FEATURE_MISSING(context);
        case "output":
            return sizes ? html`
                ${selectField(context, layer, "select", msg("Output"), features, context.editmode !== "edit")}
                ${selectField(context, layer, "loss", msg("Loss Function"), LOSSES)}` : FEATURE_MISSING(context);
        case "fcl":
            return html`${numberField(context, layer, { key: "dim", label: msg("Output Nodes"), min: 1, max: 500 })}${parameters(context, info)}`;
        case "conv":
        case "transposeconv":
            return html`
                ${numberField(context, layer, { key: "kernel", label: msg("Kernel Size"), min: 1, max: 9, text: true })}
                ${numberField(context, layer, { key: "stride", label: msg("Stride"), min: 1, max: 7, text: true })}
                ${numberField(context, layer, { key: "numkernels", label: msg("# of Kernels"), min: 1, max: layer.type === "conv" ? 10 : 20, text: true })}
                ${parameters(context, info)}`;
        case "activation":
            return selectField(context, layer, "act", msg("Function"), ACTIVATIONS);
        case "dropout":
            return numberField(context, layer, { key: "rate", label: msg("Rate"), min: 0, max: 1, step: 0.05, float: true });
        case "noise":
            return numberField(context, layer, { key: "strength", label: msg("Strength"), min: 0, max: 1, step: 0.01, float: true, text: true });
        case "reshape": {
            const shape = (layer.shape as string[]) ?? ["1", "1", "1"];
            const error = info.reshapeError ? msg(str`Output shape invalid: ${info.reshapeError.from} != ${info.reshapeError.to}`) : "";
            return html`
                ${shape.map((dim, index) => html`<sl-input type="number" size="small" label=${msg(str`${index + 1}th dim`)} min="0" .value=${String(dim)}
                    ?disabled=${context.editmode === "read"}
                    @sl-input=${(event: Event) => reshapeDim(context, layer, index, (event.target as HTMLInputElement).value, false)}
                    @sl-change=${(event: Event) => reshapeDim(context, layer, index, (event.target as HTMLInputElement).value, true)}></sl-input>`)}
                <p><span style="color: red">${error}</span></p>`;
        }
        default:
            return nothing;
    }
}

function reshapeDim(context: FieldsContext, layer: LayerState, index: number, text: string, settle: boolean) {
    const number = parseInteger(text);
    if (!settle && !(number >= 0 && number <= 9999999)) return;
    const value = Math.min(9999999, Math.max(0, Number.isNaN(number) ? 0 : number));
    const shape = [...((layer.shape as string[]) ?? ["1", "1", "1"])];
    shape[index] = String(value);
    context.change(layer.id, { shape });
}
