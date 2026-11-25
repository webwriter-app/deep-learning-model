import { str, type MsgFn } from "@lit/localize";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import SlTabGroup from "@shoelace-style/shoelace/dist/components/tab-group/tab-group.component.js";
import SlTab from "@shoelace-style/shoelace/dist/components/tab/tab.component.js";
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { LitElementWw } from "@webwriter/lit";
import { jsonData } from "@webwriter/lit/data";
import { localizer } from "@webwriter/lit/localize";
import { css, html, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localeOptions } from "../../localization/locale-options";
import { DatasetInput } from "../components/dataset-input/dataset-input";
import "../components/dataset/class";
import "../components/dataset/image";
import "../components/dataset/linear";
import { hostStyles } from "../components/host.styles";
import { Dataset, TransformedDataset } from "../model/dataset/dataset";
import { Constructor, FeatureSettings, FeatureTransformation, getFeatureTransformation, getFeatureTransformations } from "../model/dataset/feature";
import { tableElement } from "../components/table-element";
import { samplesFromJson, samplesToTable, tableToCsv, toSamples, type Sample, type TableProblem } from "../model/dataset/table";
import getTF from "../model/tflib";

BigInt.prototype.toJSON = function () {
  return this.toString();
};
Uint8Array.prototype.toJSON = function () {
  // Convert Uint8Array to base64 for efficient storage
  let binary = '';
  const len = this.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(this[i]);
  }
  return btoa(binary);
};

type Labelled = { msg: MsgFn };

type FieldProp = {
  type:"Class Encoding"|"Number Encoding"|"Image Encoding"|"Ignore",
  settings: FeatureSettings
}

/**
 * A widget that allows feature engineering on a dataset
 *
 * Conversions: a `table` (first row is the header) and the files `.csv` (`text/csv`) and `.json` (an array of objects)
 * replace the dataset; the dataset leaves as a `table` or as `text/csv`. Imports reset the feature settings of the
 * columns to "Ignore", and exports carry only the samples, not the settings. Every value becomes text. The Model
 * Designing widget also takes a `.json` file (a list of layers); each import validates its file and rejects the shape of
 * the other, so a wrongly routed file changes nothing.
 *
 * @event change - Fired when the dataset changes. Detail contains { dataset: Dataset, tensorDataset: TransformedDataset }
 *
 * @part table - The table that shows the values of the selected column and their tensors.
 */
@customElement("webwriter-feature-engineering")
export class WebwriterFeatureEngineering extends LitElementWw {
  static styles = [hostStyles, css`
    .table-fields {
      width: 100%;
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      align-content: stretch;
      justify-content: center;
      align-items: stretch;
    }
    .table-fields sl-button {
      flex-grow: 2;
    }
    :host([contenteditable]) {
      min-height: 100px;
    }
    :host([contenteditable][editmode="hidden"]) {
      min-height: 30px;
      background:lightgray;
    }
    :host .tabs {
      margin-bottom: 5px;
    }
    :host div.settings {
      display:flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-content: center;
      align-items: center;
      justify-content: flex-start;
    }
    :host div.settings * {
      flex-grow:1;
    }
    .columns {
      overflow-x: auto;
    }
    .columns sl-button-group {
      width: max-content;
    }
    :host div.props {
      overflow-x: auto;
    }
    :host div.props table {
      width: 100%;
      position:relative;
      table-layout: fixed;
    }
    :host div.props table td * {
      overflow:hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      max-height: 26px;
      white-space: nowrap;
      margin: 0px;
    }
    :host div.props table td:nth-child(2) {
      text-align: right;
    }
    p {
      margin:5px 0px;
    }
    img {
      object-fit: contain;
      max-width: 100%;
    }
    @container (max-width: 520px) {
      :host div.settings * {
        flex-basis: 100%;
      }
    }
    @media print {
      .columns {
        overflow: visible;
      }
      .columns sl-button-group {
        width: auto;
        flex-wrap: wrap;
      }
      :host div.props table {
        break-inside: avoid;
      }
      :host([editmode="hidden"]) {
        display: none;
      }
    }
  `]

  /** @internal */
  static scopedElements = {
    "sl-button": SlButton,
    "sl-button-group": SlButtonGroup,
    "dataset-input": DatasetInput,
    "sl-option": SlOption,
    "sl-select": SlSelect,
    "sl-input": SlInput,
    "sl-tab":SlTab,
    "sl-tab-group":SlTabGroup,
    "sl-tooltip":SlTooltip
  }

  static options = {
    editMode: {
      type: "select" as const,
      label: (widget: Labelled) => widget.msg("Edit permissions"),
      options: [
        {value: "edit", label: (widget: Labelled) => widget.msg("Edit everything")},
        {value: "read", label: (widget: Labelled) => widget.msg("Read only")},
        {value: "feat", label: (widget: Labelled) => widget.msg("Feature settings only")},
        {value: "hidden", label: (widget: Labelled) => widget.msg("Hide widget")},
      ],
    },
  }

  static actions = {
    deleteDataset: {
      label: (widget: Labelled) => widget.msg("Delete dataset"),
      confirm: (widget: Labelled) => widget.msg("Delete this dataset?"),
      intent: "danger" as const,
    },
  }

  static convertFrom = {
    table: "loadTable",
    ".csv": "importCsv",
    "text/csv": "importCsv",
    ".json": "importJson",
  }

  static convertTo = {
    table: "toTable",
    "text/csv": "exportCsv",
  }

  readonly localize = localizer(this, localeOptions);
  public readonly msg = this.localize.msg;

  #data = jsonData<{samples: Array<Record<string, string>> | null, fieldProps: Record<string, FieldProp>}>(this, {
    defaults: {samples: null, fieldProps: {}},
    changed: () => this.syncSamples(),
  });

  /**
   * The number of samples used for the dataset
   */
  @property({ type: Number, attribute: true, reflect: true })
  accessor limit: number = 1000;

  /**
   * What students will be able to edit in the explorable. Ranging from "edit" = everything, "feat" = only feature settings, "read" = read only, to "hidden" = invisible to the students.
   */
  @property({ type: String, attribute: true, reflect: true })
  accessor editMode: "edit"|"feat"|"read"|"hidden" = "edit";

  @property({ type: Boolean })
  protected accessor isInitiated = false;

  /**
   * Stores the settings of the feature columns
   */
  @state()
  private accessor storedFieldProps: Record<string, FieldProp> = {};

  get fieldProps() { return this.storedFieldProps; }

  set fieldProps(value: Record<string, FieldProp>) {
    this.storedFieldProps = value;
    this.saveSamples(this.samples, value);
  }

  private samples: Array<Record<string, string>> | null = null;
  private rawDataset: Dataset | null = null;
  private tensorDataset: TransformedDataset | null = null;

  /**
   * The selected feature column
   */
  private activeHeader = "";

  constructor() {
    super();

    getTF().then((tf) => {
      tf.setBackend("cpu").then(() => {
        tf.ready().then(() => {
          this.isInitiated = true;
        });
      });
    })
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this._triggerChanged();
  }

  private syncSamples() {
    const { samples, fieldProps } = this.#data.get();
    this.samples = Array.isArray(samples) ? samples : null;
    this.storedFieldProps = fieldProps ?? {};
    this.rawDataset = null;
    this.requestUpdate();
  }

  private saveSamples(samples: Array<Record<string, string>> | null, fieldProps: Record<string, FieldProp>) {
    this.#data.set({samples, fieldProps});
  }

  /**
   * Called when a new dataset is provided
   * @param data The dataset
   * @param errors Possible errors from loading the dataset
   * @param meta Should at least contain a list of feature column names in meta.fields
   */
  private handleDataset(data: Array<Record<string, string>>, errors: Array<unknown>, meta: { fields: string[] }) {
    this.samples = data;
    this.rawDataset = new Dataset(this.samples);
    this.fieldProps = Object.fromEntries(meta.fields.map((field: string): [string, FieldProp] => [field, {type: "Ignore", settings: null}]));
    this.updateTensorDataset();
    this._triggerChanged();
  }

  deleteDataset() {
    this.storedFieldProps = {};
    this.saveSamples(null, {});
    this.samples = null;
    this.rawDataset = null;
    this.tensorDataset = null;
    this.requestUpdate();
    this._triggerChanged();
  }

  /** Replaces the dataset. The tensors are built when the widget renders. */
  private replaceDataset(samples: Sample[], fields: string[]) {
    this.samples = samples;
    this.rawDataset = null;
    this.tensorDataset?.clearCache();
    this.tensorDataset = null;
    this.activeHeader = "";
    this.fieldProps = Object.fromEntries(fields.map((field): [string, FieldProp] => [field, {type: "Ignore", settings: null}]));
    this.requestUpdate();
  }

  private problem(code: TableProblem) {
    switch (code) {
      case "no-columns": return this.msg("The data has no columns.");
      case "duplicate-columns": return this.msg("The column names are empty or not unique.");
      case "no-rows": return this.msg("The data has no rows.");
      case "ragged": return this.msg("A row has more values than the header.");
    }
  }

  /** Takes the first table of the fragment: the first row is the header. Declines a table without usable data. */
  loadTable(fragment: DocumentFragment) {
    const rows = Array.from(fragment.querySelector("table")?.rows ?? [], row => Array.from(row.cells, cell => cell.textContent?.trim() ?? ""));
    const result = rows.length > 0 ? toSamples(rows[0], rows.slice(1)) : "no-columns";
    if (typeof result === "string") return false;
    this.replaceDataset(result.samples, result.fields);
  }

  /** The dataset as a table with the samples, or null without a dataset. */
  toTable() {
    if (!this.samples?.length) return null;
    return tableElement(samplesToTable(this.samples));
  }

  /** Reads a CSV file with a header row and returns the function that replaces the dataset. */
  async importCsv(file: File) {
    const {default: Papa} = await import("papaparse");
    const text = await file.text();
    const cells = await new Promise<string[][]>(resolve => Papa.parse<string[]>(text, {skipEmptyLines: "greedy", complete: results => resolve(results.data)}));
    const result = cells.length > 0 ? toSamples(cells[0], cells.slice(1)) : "no-columns";
    if (typeof result === "string") throw new Error(this.problem(result));
    return () => this.replaceDataset(result.samples, result.fields);
  }

  /** Reads a JSON file with an array of objects and returns the function that replaces the dataset. */
  async importJson(file: File) {
    let value: unknown;
    try { value = JSON.parse(await file.text()); }
    catch { throw new Error(this.msg("The file is not valid JSON.")); }
    const result = samplesFromJson(value);
    if (typeof result === "string") throw new Error(this.msg("Expected a JSON array of objects.") + (result === "no-columns" ? "" : " " + this.problem(result)));
    return () => this.replaceDataset(result.samples, result.fields);
  }

  /** The samples as CSV, or null without a dataset. */
  exportCsv() {
    if (!this.samples?.length) return null;
    return new File([tableToCsv(samplesToTable(this.samples))], "dataset.csv", {type: "text/csv"});
  }

  /**
   * Returns the current dataset in both raw and tensor form
   */
  getDataset() {
    return { rawDataset: this.rawDataset, tensorDataset: this.tensorDataset }
  }

  /**
   * Checks whether the dataset is ready to be used
   * @returns True if both raw and tensor dataset are available
   */
  public isReady(): boolean {
    return this.rawDataset != null && this.tensorDataset != null;
  }

  /**
   * Called everytime settings change to generate the new tensor dataset.
   */
  private updateTensorDataset() {
    if (!this.rawDataset)
      return;
    let transformations: Record<string, Constructor<FeatureTransformation>> = {}
    let settings: Record<string, FeatureSettings> = {};
    for (let field in this.fieldProps) {
      if (this.fieldProps[field].type != "Ignore") {
        transformations[field] = getFeatureTransformation(this.fieldProps[field].type).constructor;
        settings[field] = this.fieldProps[field].settings;
      }
    }
    if (this.tensorDataset)
      this.tensorDataset.clearCache();
    this.tensorDataset = new TransformedDataset(this.rawDataset, transformations, settings);
  }

  /**
   * Switches to the clicked tab
   * @param e The event from the button of the tab
   */
  private handleHeaderClick(e: Event) {
    let field = (e.currentTarget as HTMLElement).innerText
    this.activeHeader = field;
    this.requestUpdate();
  }

  /**
   * Called when the limit is chanded
   */
  private handleSizeChange() {
    if (!this.samples)
      return;
    this.rawDataset = new Dataset(this.samples, 0.7, 0.2, this.limit);
    this.updateTensorDataset();
    this._triggerChanged();
  }

  private handleLimitChange(e: Event) {
    this.limit = parseInt((e.target as SlInput).value);
    if (isNaN(this.limit) || this.limit < 1)
      this.limit = 1000;
    this.handleSizeChange();
  }

  /**
   * Called when the user changes the feature settings
   * @param settings New settings
   */
  private handleFeatureSettingsChange(settings: FeatureSettings) {
    this.fieldProps[this.activeHeader] = { ...this.fieldProps[this.activeHeader], settings };
    this.fieldProps = Object.assign({}, this.fieldProps);
    this.tensorDataset?.clearCache();
    this.updateTensorDataset();
    this.requestUpdate();
    this._triggerChanged();
  }

  /**
   * Tells listening widgets when the dataset changed
   */
  private _triggerChanged() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        dataset: this.rawDataset,
        tensorDataset: this.tensorDataset
      }
    }));
  }

  private renderSelectDataset() {
    return html`
      <dataset-input
        @readDataset=${(e: CustomEvent) => this.handleDataset(e.detail.data, e.detail.errors, e.detail.meta)}
      ></dataset-input>
    `
  }

  private renderTableHeader(dataset: Dataset) {
    if (this.activeHeader == "")
      this.activeHeader = dataset.fields[0];
    let tabs = new Array<TemplateResult>();
    for (let header of dataset.fields) {
      tabs.push(html`<sl-button @click=${this.handleHeaderClick} variant=${header == this.activeHeader ? "primary": "default"}>${header}</sl-button>`);
    }
    return html`<p>${this.msg("Dataset Feature Colums:")}</p><div class="columns"><sl-button-group>${tabs}</sl-button-group></div>`
  }

  private renderFieldValues(samples: Array<Record<string, string>>, fieldName: string) {
    if (fieldName == "")
      return html`<div class="props"><p>${this.msg("Choose a column to format it")}</p></div>`

    if (this.fieldProps[fieldName].type == "Ignore") {
      let rows = samples.slice(0, 10).map(
        (v) => html`<tr><td><p>${JSON.stringify(v[fieldName])}</p></td></tr>`
      )
      return html`<div class="props" part="table"><table><thead><td>${fieldName}</td><td>${this.msg("Tensor")}</td></thead><tbody>${rows}</tbody></table></div>`
    } else {
      let Transformation = getFeatureTransformation(this.fieldProps[fieldName].type).constructor;
      try {
        let transformation = new Transformation(samples.map(v => v[fieldName]), this.fieldProps[fieldName].settings)
        let rows = samples.slice(0, 10).map(
          (v) => {
            const value = v[fieldName];
            const displayValue = transformation.renderOriginalValue(value);
            return html`<tr><td><p>${displayValue}</p></td><td><p>${transformation.renderTransformedValue(value, this.msg)}</p></td></tr>`
          }
        )
        return html`<div class="settings">${transformation.getSettingElement((settings: FeatureSettings) => { this.handleFeatureSettingsChange(settings) }, this.editMode, this.msg)}</div><div class="props" part="table"><table><thead><td>${fieldName}</td><td>${this.msg("Tensor")}</td></thead><tbody>${rows}</tbody></table></div>`
      } catch (e) {
        return html`<p style="background: red">${this.msg("This Transformation is not applicable for the values")}</p><div class="props" part="table"><table><thead><td>${fieldName}</td><td>${this.msg("Tensor")}</td></thead></table></div>`
      }
    }
  }

  private renderFieldTypeSelector(fieldName: string) {
    if (fieldName == "")
      return html``;

    let options = new Array<TemplateResult>();
    for (let option of getFeatureTransformations()) {
      let optionName;
      switch (option.name) {
        case "Class Encoding":
          optionName = this.msg("Class Encoding");
          break;
        case "Number Encoding":
          optionName = this.msg("Number Encoding");
          break;
        case "Image Encoding":
          optionName = this.msg("Image Encoding");
          break;
        case "Ignore":
          optionName = this.msg("Ignore");
          break;
        default:
          optionName = option.name;
      }
      options.push(html`<sl-option value=${option.name.replaceAll(" ", "_")}>${optionName}</sl-option>`)
    }

    const onchange = (e: Event) => {
      let value = (e.target as SlSelect).value as string;
      this.fieldProps[fieldName].type = value.replaceAll("_", " ") as FieldProp["type"];
      // A new object reference is needed to refresh the attribute and to save
      this.fieldProps = Object.assign({}, this.fieldProps);
      this.updateTensorDataset();
      this._triggerChanged();
    }

    return html`<sl-tooltip content=${this.msg("Select how you want the string to be interpreted.")}><sl-select label=${this.msg("Data Type")} @sl-change=${onchange} value=${this.fieldProps[fieldName].type.replaceAll(" ", "_")} ?disabled=${!(this.editMode == "edit")}>${options}</sl-select></sl-tooltip>`
  }

  render() {
    if (!this.isInitiated)
      return html`<p>${this.msg("Loading Tensorflow...")}</p>`
    const samples = this.samples;
    if (samples == null)
      return this.renderSelectDataset();
    else {
      if (this.limit == null)
        this.limit = Math.min(samples.length, 1000);

      if (this.rawDataset == null) {
        this.rawDataset = new Dataset(samples, 0.7, 0.2, this.limit);
        this.updateTensorDataset();
      }

      this._triggerChanged();

      return html`
      <p style=${this.editMode != "hidden" ? "display:none" : ""}>${this.msg("Feature Engineering Widget hidden from students.")}</p>
      <div id="content" style=${this.editMode == "hidden" ? "display:none" : ""}>
        <p>${this.msg("Dataset using")} <sl-input type="number" min="1" max=${String(samples.length)} value=${this.limit} @sl-change=${this.handleLimitChange} style="display:inline-block" ?disabled=${this.editMode != "edit"}></sl-input> ${this.msg(str`of ${samples.length} Samples`)}</p>
        ${this.renderTableHeader(this.rawDataset)}
        ${this.renderFieldTypeSelector(this.activeHeader)}
        ${this.renderFieldValues(samples, this.activeHeader)}
      </div>
      `;
    }
  }
}
