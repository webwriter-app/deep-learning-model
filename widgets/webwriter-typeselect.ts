import {html, css, TemplateResult, PropertyValues} from "lit"
import {LitElementWw, OptionDeclaration, ActionDeclaration} from "@webwriter/lit"
import {customElement, property, state} from "lit/decorators.js"
import "@shoelace-style/shoelace/dist/themes/light.css";

@customElement("webwriter-typeselect")
export class AiWidgetsTypeSelect extends LitElementWw {
  static scopedElements = {
  }

  static styles = css`
    :host {
      min-height: 200px;
      display:block;
    }
  `

  public options: Record<string, OptionDeclaration> = {}

  public render(): TemplateResult {
    return html`<p>Hi</p>`
  }
}