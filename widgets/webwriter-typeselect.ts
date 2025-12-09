import "@shoelace-style/shoelace/dist/themes/light.css";
import { LitElementWw, OptionDeclaration } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

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
