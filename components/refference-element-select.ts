import { html, css, TemplateResult, PropertyValues } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, eventOptions, property, state } from "lit/decorators.js"
import "@shoelace-style/shoelace/dist/themes/light.css";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js"
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js"
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js"
import { AiWidgetsFeatures } from "../widgets/webwriter-features";

@customElement("ref-select")
export class AiWidgetsReferenceSelect extends LitElementWw {
    static scopedElements = {
        "sl-select": SlSelect,
        "sl-option": SlOption,
        "sl-button": SlButton
    }

    static styles = css`
    :host {
      min-height: 200px;
      display:block;
    }
    `

    constructor() {
        super();
        let that = this;
        setInterval(function () {
            that.requestUpdate();
        }, 1000);
    }

    public options: Record<string, OptionDeclaration> = {}

    @property({ type: String, attribute: true })
    accessor elemId: string;

    @property({ type: String, attribute: true })
    accessor "element-type": string;

    public render(): TemplateResult {
        let that = this;
        let elements = document.querySelectorAll(this["element-type"])
        let options = [];
        elements.forEach(function (elem: AiWidgetsFeatures) {
            let option = document.createElement("sl-option")
            option.innerText = elem.id;
            option.value = elem.id;
            options.push(option)
        })
        function changeElem(e: Event) {
            that.elemId = (e.target as SlSelect).value as string;
            highlight();
            this.dispatchEvent(new CustomEvent('refchange', {
                detail: {
                    id: that.elemId
                }
            }));
        }
        function highlight() {
            if (that.elemId == "")
                return;
            let elem = that.getRefElement();
            elem.style.boxShadow = "0px 0px 5px 5px orange";
            setTimeout(function () {
                elem.style.boxShadow = "";
            }, 1000);
        }
        return html`<sl-select value=${this.elemId} placeholder="Select Source Element" @sl-focus=${highlight} @sl-change=${changeElem}>
            ${options}
        </sl-select>
        <sl-button @click=${highlight} id="btn">Show selection</sl-button>
        `
    }

    getRefElement() {
        return document.querySelector("#" + this.elemId) as HTMLElement
    }
}

