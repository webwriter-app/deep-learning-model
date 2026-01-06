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
import { css, html, PropertyValues, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DatasetInput } from "../components/dataset-input/dataset-input";
import "../lib/dataset/class";
import { Dataset, TransformedDataset, } from "../lib/dataset/dataset";
import { FeatureTransformation, getFeatureTransformation, getFeatureTransformations } from "../lib/dataset/feature";
import "../lib/dataset/image";
import "../lib/dataset/linear";
import getTF from "../lib/tflib";
import { msg, str } from "@lit/localize";
import LOCALIZE from "../localization/generated";
type Constructor<T> = new (...args: any[]) => T;

BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
Uint8Array.prototype["toJSON"] = function () {
  // Convert Uint8Array to base64 for efficient storage
  let binary = '';
  const len = this.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(this[i]);
  }
  return btoa(binary);
};

type FieldProp = {
  type:"Class Encoding"|"Number Encoding"|"Image Encoding"|"Ignore",
  settings:any
}

/**
 * A widget that allows feature engineering on a dataset
 * 
 * @event change - Fired when the dataset changes. Detail contains { dataset: Dataset, tensorDataset: TransformedDataset }
 */
@customElement("webwriter-feature-engineering")
export class AiWidgetsFeatures extends LitElementWw {
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

  protected localize = LOCALIZE;

  static styles = css`
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
    :host {
      display:block;
    }
    :host([contenteditable]) {
      min-height: 100px;
    }
    :host([contenteditable][editmode="hidden"]) {
      min-height: 30px;
      background:lightgray;
    }
    :host div[part='options'] {
      display:none;
    }
    :host([contenteditable]) div[part='options'] {
      display:block;
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
    :host div.props table {
      width: 100%;
      position:relative;
    }
    :host div.props table td * {
      overflow:hidden;
      text-overflow: ellipsis;
      width: 390px;
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
    }
  `

  /**
   * The original decompressed data in a json string with format of RawSample[]
   */
  @property({ type: String, attribute: true, reflect: true })
  accessor samplesSave: string;

  private samples: Array<Record<string, string>>;

  /**
   * Stores the settings of the feature columns
   */
  @property({ type: Object, attribute: true, reflect: true })
  accessor fieldProps: Record<string, FieldProp>;

  private rawDataset: Dataset;
  private tensorDataset: TransformedDataset;

  /**
   * The selected feature column
   */
  private activeHeader = "";

  /**
   * The number of samples used for the dataset
   */
  @property({ type: Number, attribute: true, reflect: true })
  accessor limit: number = 1000;


  @property({ type: Boolean })
  protected accessor isInitiated = false;

  /**
   * What students will be able to edit in the explorable. Ranging from "edit" = everything, "feat" = only feature settings, "read" = read only, to "hidden" = invisible to the students.
   */
  @property({ type: String, attribute: true, reflect: true })
  accessor editMode: "edit"|"feat"|"read"|"hidden" = "edit";

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

  private renderSelectDataset() {
    return html`
      <dataset-input
        @readDataset=${(e: CustomEvent) => this.handleDataset(e.detail.data, e.detail.errors, e.detail.meta)}
      ></dataset-input>
    `
  }

  private renderTableHeader() {
    if (this.activeHeader == "")
      this.activeHeader = this.rawDataset.fields[0];
    let tabs = new Array<TemplateResult>();
    for (let header of this.rawDataset.fields) {
      tabs.push(html`<sl-button @click=${this.handleHeaderClick} variant=${header == this.activeHeader ? "primary": "default"}>${header}</sl-button>`);
    }
    return html`<p>${msg("Dataset Feature Colums:")}</p><sl-button-group>${tabs}</sl-button-group>`
  }

  private renderFieldValues(fieldName: string) {
    if (fieldName == "")
      return html`<div class="props"><p>${msg("Choose a column to format it")}</p></div>`

    let that = this;
    let rows;
    if (this.fieldProps[fieldName].type == "Ignore") {
      rows = this.samples.slice(0, 10).map(
        function (v) {
          return html`<tr><td><p>${JSON.stringify(v[fieldName])}</p></td></tr>`
        }
      )
      return html`<div class="props"><table><thead><td>${fieldName}</td><td>${msg("Tensor")}</td></thead><tbody>${rows}</tbody></table></div>`
    } else {
      let Transformation = getFeatureTransformation(this.fieldProps[fieldName].type).constructor;
      try {
        let transformation = new Transformation(this.samples.map(v => v[fieldName]), this.fieldProps[fieldName].settings)
        let rows = this.samples.slice(0, 10).map(
          function (v) {
            const value = v[fieldName];
            const displayValue = transformation.renderOriginalValue(value);
            return html`<tr><td><p>${displayValue}</p></td><td><p>${transformation.renderTransformedValue(value)}</p></td></tr>`
          }
        )
        return html`<div class="settings">${transformation.getSettingElement(function (settings) { that.handleFeatureSettingsChange(settings) }, this.editMode)}</div><div class="props"><table><thead><td>${fieldName}</td><td>${msg("Tensor")}</td></thead><tbody>${rows}</tbody></table></div>`
      } catch (e) {
        console.log(e);
        return html`<p style="background: red">${msg("This Transformation is not applicable for the values")}</p><div class="props"><table><thead><td>${fieldName}</td><td>${msg("Tensor")}</td></thead></table></div>`
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
          optionName = msg("Class Encoding");
          break;
        case "Number Encoding":
          optionName = msg("Number Encoding");
          break;
        case "Image Encoding":
          optionName = msg("Image Encoding");
          break;
        case "Ignore":
          optionName = msg("Ignore");
          break;
        default:
          optionName = option.name;
      }
      options.push(html`<sl-option value=${option.name.replaceAll(" ", "_")}>${optionName}</sl-option>`)
    }

    let that = this;
    function onchange(e: Event) {
      let value = (e.target as SlSelect).value as string;
      that.fieldProps[fieldName].type = value.replaceAll("_", " ") as FieldProp["type"];
      //Deep copy for new reference to trigger refreshing the attribute and save ;-;
      that.fieldProps = Object.assign({}, that.fieldProps);
      that.updateTensorDataset();
      that._triggerChanged();
    }

    return html`<sl-tooltip content=${msg("Select how you want the string to be interpreted.")}><sl-select label=${msg("Data Type")} @sl-change=${onchange} value=${this.fieldProps[fieldName].type.replaceAll(" ", "_")} ?disabled=${!(this.editMode == "edit")}>${options}</sl-select></sl-tooltip>`
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this._triggerChanged();
  }

  render() {
    if (!this.isInitiated)
      return html`<p>${msg("Loading Tensorflow...")}</p>`
    if (this.samplesSave && !this.samples)
      this.samples = JSON.parse(this.samplesSave);
    if (this.samples == null)
      return this.renderSelectDataset();
    else {
      if (this.limit == null)
        this.limit = Math.min(this.samples.length, 1000);

      if (this.rawDataset == null) {
        this.rawDataset = new Dataset(this.samples, 0.7, 0.2, this.limit);
        this.updateTensorDataset();
      }

      this._triggerChanged();

      function editModeChanged(e: Event) {
        const select = e.target as HTMLSelectElement;
        this.editMode = select.value;
      }

      return html`
      <div part="options">
        <sl-button id="reset" variant="warning" @click=${this.deleteDataset}>${msg("Delete dataset")}</sl-button>
        <sl-select label=${msg("Edit Permissions")} value=${this.editMode} @sl-change=${editModeChanged}>
          <sl-option value="hidden">${msg("hide widget")}</sl-option>
          <sl-option value="read">${msg("read only")}</sl-option>
          <sl-option value="feat">${msg("feature settings only")}</sl-option>
          <sl-option value="edit">${msg("edit everything")}</sl-option>
        </sl-select>
      </div>
      <p style=${this.editMode != "hidden" ? "display:none" : ""}>${msg("Feature Engineering Widget hidden from students.")}</p>
      <div id="content" style=${this.editMode == "hidden" ? "display:none" : ""}>
        <p>${msg("Dataset using")} <sl-input type="number" min="1" max=${String(this.samples.length)} value=${this.limit} @sl-change=${function(e:Event) {this.limit = parseInt((e.target as SlInput).value); if (isNaN(this.limit) || this.limit < 1) this.limit = 1000; this.handleSizeChange()}} style="display:inline-block" ?disabled=${this.editMode != "edit"}></sl-input> ${msg(str`of ${this.samples.length} Samples`)}</p>
        ${this.renderTableHeader()}
        ${this.renderFieldTypeSelector(this.activeHeader)}
        ${this.renderFieldValues(this.activeHeader)}
      </div>
      `;
    }
  }

  /**
   * Called when a new dataset is provided
   * @param data The dataset
   * @param errors Possible errors from loading the dataset
   * @param meta Should at least contain a list of feature column names in meta.fields
   */
  private handleDataset(data: Array<Record<string, string>>, errors: Array<any>, meta: any) {
    console.log("handle")
    this.samplesSave = JSON.stringify(data);
    this.samples = data;
    this.rawDataset = new Dataset(this.samples);
    this.fieldProps = {}
    for (let field of meta.fields) {
      this.fieldProps[field] = { type: "Ignore", settings: null };
    }
    this.updateTensorDataset();
    this._triggerChanged();
  }


  /**   
   * Returns the current dataset in both raw and tensor form
   */
  getDataset() {
    return { rawDataset: this.rawDataset, tensorDataset: this.tensorDataset }
  }

  /**
   * Called everytime settings change to generate the new tensor dataset.
   */
  private updateTensorDataset() {
    let transformations: Record<string, Constructor<FeatureTransformation>> = {}
    let settings: Record<string, Constructor<FeatureTransformation>> = {};
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

  private deleteDataset() {
    this.samplesSave = null;
    this.samples = null;
    this.rawDataset = null;
    this.tensorDataset = null;
    this.requestUpdate();
    this._triggerChanged();
  }

  /**
   * Called when the limit is chanded
   */
  private handleSizeChange() {
    this.rawDataset = new Dataset(this.samples, 0.7, 0.2, this.limit);
    this.updateTensorDataset();
    this._triggerChanged();
  }

  /**
   * Called when the user changes the feature settings
   * @param settings New settings
   */
  private handleFeatureSettingsChange(settings: Record<string, any>) {
    this.fieldProps[this.activeHeader] = { ...this.fieldProps[this.activeHeader], settings };
    this.fieldProps = Object.assign({}, this.fieldProps);
    this.tensorDataset.clearCache();
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

  /**
   * Checks whether the dataset is ready to be used
   * @returns True if both raw and tensor dataset are available
   */
  public isReady(): boolean {
    return this.rawDataset != null && this.tensorDataset != null;
  }
}