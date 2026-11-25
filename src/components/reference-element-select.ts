import { widgetMsg } from "@webwriter/lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import "@shoelace-style/shoelace/dist/themes/light.css";
import { LitElementWw } from "@webwriter/lit";
import { css, html, TemplateResult } from "lit";
import { property } from "lit/decorators.js";

export class AiWidgetsReferenceSelect extends LitElementWw {
    private readonly msg = widgetMsg(this);
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

    @property({ type: String, attribute: true })
    accessor elemId: string;

    @property({ type: String, attribute: true })
    accessor elementType: string;

    @property({ type: String, attribute: true })
    accessor typeName: string;

    @property({ type: String })
    accessor ownerId: string;

    private lastRef: HTMLElement | null = null;

    updated(changed: Map<string, unknown>) {
        if (!changed.has("elemId")) return;
        const previous = this.lastRef;
        this.lastRef = this.getRefElement();
        this.dispatchEvent(new CustomEvent("refchange", {
            detail: {id: this.elemId || null, lastRef: previous},
        }));
    }

    private highlight() {
        if (this.elemId == "")
            return;
        let elem = this.getRefElement();
        if (!elem)
            return;
        elem.style.boxShadow = "0px 0px 5px 5px orange";
        setTimeout(function () {
            elem.style.boxShadow = "";
        }, 1000);
    }

    private changeElem(e: Event) {
        this.elemId = (e.target as SlSelect).value as string;
        this.highlight();
        this.dispatchEvent(new CustomEvent('refchange', {
            detail: {
                id: this.elemId,
                lastRef: this.lastRef
            }
        }));
        this.lastRef = this.getRefElement();
    }

    public render(): TemplateResult {
        const options = Array.from(document.querySelectorAll(this.elementType), (elem, index) =>
            html`<sl-option value=${elem.id}>${`${this.typeName} ${index + 1}`}</sl-option>`);
        return html`<sl-select id="elemselect" value=${this.elemId} placeholder=${this.msg("Select Source Element")} @sl-focus=${this.highlight} @sl-change=${this.changeElem}>
            ${options}
        </sl-select>
        <sl-button @click=${this.highlight} id="btn">${this.msg("Show selection")}</sl-button>
        `
    }

    public getRefElement() {
        return this.elemId ? this.ownerDocument.getElementById(this.elemId) : null
    }
}
