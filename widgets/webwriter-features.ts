import { html, css, TemplateResult, PropertyValues } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state } from "lit/decorators.js"
import "@shoelace-style/shoelace/dist/themes/light.css";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js"
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js"
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js"
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js"
import { DatasetInput } from "../components/dataset-input/dataset-input"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import { registerCommunicator, Communicator } from "../lib/apis/com";
import * as tf from '@tensorflow/tfjs';
type Constructor<T> = new (...args: any[]) => T;

BigInt.prototype["toJSON"] = function () {
  return this.toString();
};

@customElement("webwriter-features")
export class AiWidgetsFeatures extends LitElementWw {
  static scopedElements = {
    "sl-button": SlButton,
    "sl-button-group": SlButtonGroup,
    "dataset-input": DatasetInput,
    "sl-option": SlOption,
    "sl-select": SlSelect
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
    :host > div.headers {
      display:flex;
      flex-direction: row;
      align-content: center;
      justify-content: flex-start;
      align-items: stretch;
      flex-wrap: wrap;
    }
    :host > div.headers > sl-button {
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
    }
  `

  public options: Record<string, OptionDeclaration> = {}

  @property({ type: String, attribute: true, reflect: true })
  accessor samplesSave: string;
  samples: Array<Record<string, string>>;

  @property({ type: Object, attribute: true, reflect: true })
  accessor fieldProps: object;

  private rawDataset: Dataset;
  private tensorDataset: TransformedDataset;

  private activeHeader = "";

  private communicator: Communicator;

  constructor() {
    super();
    let that = this;
    this.communicator = registerCommunicator("features", [], function () {
      return { dataset: that.rawDataset, tensorDataset: that.tensorDataset };
    }, function (name) { })
  }


  renderSelectDataset() {
    return html`
      <dataset-input
        @readDataset=${(e: CustomEvent) => this.handleDataset(e.detail.data, e.detail.errors, e.detail.meta)}
      ></dataset-input>
    `
  }

  renderTableHeader() {
    let buttons = new Array<TemplateResult>();
    for (let header of this.rawDataset.fields) {
      buttons.push(html`<sl-button @click=${this.handleHeaderClick} variant=${header == this.activeHeader ? "primary" : "default"}>${header}</sl-button>`);
    }
    return html`<div class="headers">${buttons}</div>`
  }

  renderFieldValues(fieldName: string) {
    if (fieldName == "")
      return html`<div class="props"><p>Wähle eine Tabellenspalte um sie zu formatieren</p></div>`

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
        let transformation = new Transformation(this.samples.map(v => v[fieldName]))
        let rows = this.samples.slice(0, 10).map(
          function (v) {
            return html`<tr><td><p>${JSON.stringify(v[fieldName])}</p></td><td><p>${transformation.renderTransformedValue(v[fieldName])}</p></td></tr>`
          }
        )
        return html`${transformation.getSettingElement()}<div class="props"><table><thead><td>${fieldName}</td><td>Tensor</td></thead><tbody>${rows}</tbody></table></div>`
      } catch (e) {
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
      that.fieldProps = JSON.parse(JSON.stringify(Object.assign({}, that.fieldProps)));
      this.updateTensorDataset();
      that.communicator.changed();
    }

    return html`<sl-select @sl-change=${onchange} value=${this.fieldProps[fieldName].type.replaceAll(" ", "_")}>${options}</sl-select>`
  }

  render() {
    if (this.samplesSave && !this.samples)
      this.samples = JSON.parse(this.samplesSave);
    if (this.samples == null)
      return this.renderSelectDataset();
    else {
      if (this.rawDataset == null) {
        this.rawDataset = new Dataset(this.samples);
        this.updateTensorDataset();
      }
      return html`
      <div part="options">
        <sl-button id="reset" variant="warning" @click=${this.deleteDataset}>Dataset löschen</sl-button>
      </div>
      <p>Tabellen Spalten (Features)</p>
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
      this.fieldProps[field] = { type: "Ignore" };
    }
    this.updateTensorDataset();
    this.communicator.changed();
  }

  updateTensorDataset() {
    let transformations: Record<string, Constructor<FeatureTransformation>> = {}
    for (let field in this.fieldProps) {
      if (this.fieldProps[field].type != "Ignore")
        transformations[field] = getFeatureTransformation(this.fieldProps[field].type).constructor;
    }
    this.tensorDataset = new TransformedDataset(this.rawDataset, transformations);
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
    this.communicator.changed();
  }
}