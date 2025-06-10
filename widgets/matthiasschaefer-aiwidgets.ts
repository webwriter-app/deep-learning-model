import {html, css, TemplateResult, PropertyValues} from "lit"
import {LitElementWw, OptionDeclaration, ActionDeclaration} from "@webwriter/lit"
import {customElement, property, state} from "lit/decorators.js"
import "@shoelace-style/shoelace/dist/themes/light.css";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js"
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js"
import {DatasetInput} from "../components/dataset-input/dataset-input"


@customElement("matthiasschaefer-aiwidgets")
export class MatthiasschaeferAiwidgets extends LitElementWw {
  static scopedElements = {
    "sl-button": SlButton,
    "sl-button-group": SlButtonGroup,
    "dataset-input": DatasetInput
  }

  public options: Record<string, OptionDeclaration> = {}

  @property({type:Array, attribute:true, reflect:true})
  accessor datasetFields: Array<string>;

  @property({type:Array, attribute:true, reflect:true})
  accessor samples: Array<Map<string,string>>;

  @property({type:Array, attribute:true, reflect:true})
  accessor fieldProps: Array<object>;

  private activeHeader = "";

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
  `

  renderSelectDataset() {
    return html`
      <dataset-input
        @readDataset=${(e: CustomEvent) => this.handleDataset(e.detail.data, e.detail.errors, e.detail.meta)}
      ></dataset-input>
    `
  }
  renderTableHeader() {
    let buttons = new Array<TemplateResult>();
    for (let header of this.datasetFields) {
      buttons.push(html`<sl-button @click=${this.handleHeaderClick} variant=${header == this.activeHeader ? "primary" : "default"}>${header}</sl-button>`);
    }
    return html`<div class="headers">${buttons}</div>`
  }
  renderFieldValues(fieldName: string, transformation:Function) {
    if (this.activeHeader == "")
      return html`<div class="props"><p>Wähle eine Tabellenspalte um sie zu formatieren</p></div>`

    let rows = this.samples.slice(0,30).map(
      v => html`<tr><td>${v[fieldName]}</td><td>${transformation(v[fieldName])}</td></tr>`
    )
    return html`<div class="props"><table><thead><td>${fieldName}</td></thead><tbody>${rows}</tbody></table></div>`
  }

  render() {
    if (this.datasetFields == null)
      return this.renderSelectDataset();
    else
      return html`<div part="options" ><sl-button id="reset" variant="warning" @click=${this.deleteDataset}>Dataset löschen</sl-button></div><p>Tabellen Spalten (Features)</p>${this.renderTableHeader()}${this.renderFieldValues(this.activeHeader)}`;
  }

  handleDataset(data: Array<Map<string, string>>, errors:Array<any>, meta:any) {
    this.datasetFields = meta.fields;
    this.samples = data;
  }

  handleHeaderClick(e:Event) {
    let field = (e.currentTarget as HTMLElement).innerText
    this.activeHeader = field;
    this.requestUpdate();
  }

  deleteDataset() {
    this.datasetFields = null;
    this.samples = null;
    this.requestUpdate();
  }
}