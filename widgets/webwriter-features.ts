import { html, css, TemplateResult, PropertyValues } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state } from "lit/decorators.js"
import "@shoelace-style/shoelace/dist/themes/light.css";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js"
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js"
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js"
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js"
import SlTab from "@shoelace-style/shoelace/dist/components/tab/tab.component.js"
import SlTabGroup from "@shoelace-style/shoelace/dist/components/tab-group/tab-group.component.js"
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js"
import { DatasetInput } from "../components/dataset-input/dataset-input"
import { Dataset, TransformedDataset, } from "../lib/dataset/dataset"
import "../lib/dataset/class";
import "../lib/dataset/image";
import "../lib/dataset/linear";
import { FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/dataset/feature"
import * as tf from '@tensorflow/tfjs';
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
type Constructor<T> = new (...args: any[]) => T;

BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
Uint8Array.prototype["toJSON"] = function () {
  return [...this]
};

@customElement("webwriter-features")
export class AiWidgetsFeatures extends LitElementWw {
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
      min-height: 200px;
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
    }
    :host div.props table td * {
      overflow:hidden;
      text-overflow: ellipsis;
      max-width: 600px;
      max-height: 26px;
      white-space: nowrap;
      margin: 0px;
    }
    :host div.props table td:nth-child(2) {
      text-align: right;
      float:right;
    }
  `

  public options: Record<string, OptionDeclaration> = {}

  @property({ type: String, attribute: true, reflect: true })
  accessor samplesSave: string;
  samples: Array<Record<string, string>>;

  @property({ type: Object, attribute: true, reflect: true })
  accessor fieldProps: Record<string, any>;

  private rawDataset: Dataset;
  private tensorDataset: TransformedDataset;

  private activeHeader = "";

  @property({ type: Number, attribute: true, reflect: true })
  accessor limit: number;

  @property()
  accessor isInitiated = false;

  constructor() {
    super();

    tf.setBackend("cpu").then(() => {
      tf.ready().then(() => {
        this.isInitiated = true;
      });
    });
  }

  renderSelectDataset() {
    return html`
      <dataset-input
        @readDataset=${(e: CustomEvent) => this.handleDataset(e.detail.data, e.detail.errors, e.detail.meta)}
      ></dataset-input>
    `
  }

  renderTableHeader() {
    let tabs = new Array<TemplateResult>();
    for (let header of this.rawDataset.fields) {
      tabs.push(html`<sl-tab @click=${this.handleHeaderClick} slot="nav" ?active=${false}>${header}</sl-tab>`);
    }
    if (this.activeHeader == "")
      this.activeHeader = this.rawDataset.fields[0];
    return html`<sl-tab-group class="tabs" placement="top">${tabs}</sl-tab-group>`
  }

  renderFieldValues(fieldName: string) {
    if (fieldName == "")
      return html`<div class="props"><p>Wähle eine Tabellenspalte um sie zu formatieren</p></div>`

    let that = this;
    let rows;
    if (this.fieldProps[fieldName].type == "Ignore") {
      rows = this.samples.slice(0, 10).map(
        function (v) {
          return html`<tr><td><p>${JSON.stringify(v[fieldName])}</p></td></tr>`
        }
      )
      return html`<div class="props"><table><thead><td>${fieldName}</td><td>Tensor</td></thead><tbody>${rows}</tbody></table></div>`
    } else {
      let Transformation = getFeatureTransformation(this.fieldProps[fieldName].type).constructor;
      try {
        let transformation = new Transformation(this.samples.map(v => v[fieldName]), this.fieldProps[fieldName].settings)
        let rows = this.samples.slice(0, 10).map(
          function (v) {
            let value = v[fieldName];
            if (typeof value != "string")
              value = JSON.stringify(value);
            return html`<tr><td><p>${value}</p></td><td><p>${transformation.renderTransformedValue(value)}</p></td></tr>`
          }
        )
        return html`<div class="settings">${transformation.getSettingElement(function (settings) { that.handleFeatureSettingsChange(settings) })}</div><div class="props"><table><thead><td>${fieldName}</td><td>Tensor</td></thead><tbody>${rows}</tbody></table></div>`
      } catch (e) {
        console.log(e);
        return html`<p style="background: red">This Transformation is not applicable for the values</p><div class="props"><table><thead><td>${fieldName}</td><td>Tensor</td></thead></table></div>`
      }
    }
  }

  renderFieldTypeSelector(fieldName: string) {
    if (fieldName == "")
      return html``;

    let options = new Array<TemplateResult>();
    for (let option of getFeatureTransformations()) {
      options.push(html`<sl-option value=${option.name.replaceAll(" ", "_")}>${option.name}</sl-option>`)
    }

    let that = this;
    function onchange(e: Event) {
      let value = (e.target as SlSelect).value as string
      that.fieldProps[fieldName].type = value.replaceAll("_", " ");
      //Deep copy for new reference to trigger refreshing the attribute and save ;-;
      that.fieldProps = Object.assign({}, that.fieldProps);
      that.updateTensorDataset();
      that._triggerChanged();
    }

    return html`<sl-tooltip content="Select how you want the string to be interpreted."><sl-select @sl-change=${onchange} value=${this.fieldProps[fieldName].type.replaceAll(" ", "_")}>${options}</sl-select></sl-tooltip>`
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    this._triggerChanged();
  }

  render() {
    if (!this.isInitiated)
      return html`<p>Loading Tensorflow...</p>`
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
      return html`
      <div part="options">
        <sl-button id="reset" variant="warning" @click=${this.deleteDataset}>Dataset löschen</sl-button>
      </div>
      <p>Dataset using <sl-input type="number" min="1" max=${String(this.samples.length)} value=${this.limit} @sl-change=${function(e:Event) {this.limit = parseInt((e.target as SlInput).value); if (isNaN(this.limit) || this.limit < 1) this.limit = 1000; this.handleSizeChange()}} style="display:inline-block"></sl-input> of ${this.samples.length} Samples</p>
      ${this.renderTableHeader()}
      ${this.renderFieldTypeSelector(this.activeHeader)}
      ${this.renderFieldValues(this.activeHeader)}`;
    }
  }

  handleDataset(data: Array<Record<string, string>>, errors: Array<any>, meta: any) {
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


  getDataset() {
    return { rawDataset: this.rawDataset, tensorDataset: this.tensorDataset }
  }

  updateTensorDataset() {
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

  handleHeaderClick(e: Event) {
    let field = (e.currentTarget as HTMLElement).innerText
    this.activeHeader = field;
    this.requestUpdate();
  }

  deleteDataset() {
    this.samples = null;
    this.rawDataset = null;
    this.tensorDataset = null;
    this.requestUpdate();
    this._triggerChanged();
  }

  handleSizeChange() {
    this.rawDataset = new Dataset(this.samples, 0.7, 0.2, this.limit);
    this.updateTensorDataset();
    this._triggerChanged();
  }

  handleFeatureSettingsChange(settings: Record<string, any>) {
    this.fieldProps[this.activeHeader] = { ...this.fieldProps[this.activeHeader], settings };
    this.fieldProps = Object.assign({}, this.fieldProps);
    this.tensorDataset.clearCache();
    this.updateTensorDataset();
    this.requestUpdate();
    this._triggerChanged();
  }


  _triggerChanged() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        dataset: this.rawDataset,
        tensorDataset: this.tensorDataset
      }
    }));
  }

  public isReady() {
    return this.rawDataset != null && this.tensorDataset != null;
  }
}