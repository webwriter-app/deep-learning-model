import { effectiveLanguage, localizeElement, nativeLanguageAttributes } from "../localization/localizer";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { LitElementWw, OptionDeclaration } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { property } from "lit/decorators.js";

export class AiWidgetsReferenceSelect extends LitElementWw {
    static override get observedAttributes() { return nativeLanguageAttributes(this, super.observedAttributes); }

    override get lang(): string { return effectiveLanguage(this); }
    override set lang(value: string) { this.setAttribute("lang", value); }
    private readonly msg = localizeElement(this);
    static scopedElements = {
        "sl-select": SlSelect,
        "sl-option": SlOption,
        "sl-button": SlButton
    }

    static styles = css`
    :host {
      display:block;
    }
    `

    public options: Record<string, OptionDeclaration> = {}

    @property({ type: String, attribute: true })
    accessor elemId: string;

    @property({ type: String, attribute: true })
    accessor elementType: string;

    @property({ type: String, attribute: true })
    accessor typeName: string;

    @property({ type: String }) ownerId;

    private lastRef:HTMLElement;

    updated(changed: Map<string, unknown>) {
        if (!changed.has("elemId")) return;
        const previous = this.lastRef;
        this.lastRef = this.getRefElement();
        this.dispatchEvent(new CustomEvent("refchange", {
            detail: {id: this.elemId || null, lastRef: previous},
        }));
    }

    public render(): TemplateResult {
        let that = this;
        let elements = document.querySelectorAll(this.elementType)
        let options = [];
        let index = 1;
        elements.forEach(function (elem: LitElementWw) {
            let option = document.createElement("sl-option")
            option.innerText = that.typeName + " " + index;
            option.value = elem.id;
            options.push(option)
            index++;
        })
        function changeElem(e: Event) {
            this.elemId = (e.target as SlSelect).value as string;
            highlight();
            this.dispatchEvent(new CustomEvent('refchange', {
                detail: {
                    id: that.elemId,
                    lastRef: this.lastRef
                }
            }));
            this.lastRef = this.getRefElement();
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
        return html`<sl-select id="elemselect" value=${this.elemId} placeholder=${this.msg("Select Source Element")} @sl-focus=${highlight} @sl-change=${changeElem}>
            ${options}
        </sl-select>
        <sl-button @click=${highlight} id="btn">${this.msg("Show selection")}</sl-button>
        `
    }

    public getRefElement() {
        return this.elemId ? this.ownerDocument.getElementById(this.elemId) : null
    }
}
