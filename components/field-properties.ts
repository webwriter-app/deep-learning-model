import {html, css} from "lit"
import {LitElementWw} from "@webwriter/lit"
import {customElement, property} from "lit/decorators.js"
import "@shoelace-style/shoelace/dist/themes/light.css";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js"
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js"


@customElement("matthiasschaefer-aiwidgets")
export class MatthiasschaeferAiwidgets extends LitElementWw {
  static scopedElements = {"sl-button": SlButton, "sl-button-group": SlButtonGroup}

  static styles = css``

  render() {
    return html`<h1>Field1</h1>`
  }
}