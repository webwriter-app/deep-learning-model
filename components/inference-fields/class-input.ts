import { SlOption, SlSelect } from "@shoelace-style/shoelace";
import { css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import ClassTransformation from '../../lib/dataset/class';
import { OutputElement } from './inference-interfaces';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export class ClassInput extends OutputElement {
    static scopedElements = {
        "sl-select": SlSelect,
        "sl-option": SlOption
    }

  static styles = css`
    :host {
      position: relative;
      display: inline-block;
      touch-action: none;
      width: 100%;
    }
    table {
        width: 100%;
    }
    .class {
        width: 30px;
    }
    canvas {
      background: white;
      border: 1px solid #ccc;
      touch-action: none;
      image-rendering: pixelated; /* Makes low-res canvas look better */
    }
  `;

  @property({
    type: Array,
    converter: {
        fromAttribute(value) {
            return JSON.parse(value);
        },
        toAttribute(value) {
            return JSON.stringify(value);
        }
    }
  })
  accessor classes: string[];

  @property({
    type: Boolean,
    converter: {
        fromAttribute(value) {
            return value == "true";
        },
        toAttribute(value) {
            return value;
        }
    }
  })
  accessor multi = false;

  @query("#input")
  accessor input: SlSelect;

  public async setTensor(tensor: TF.Tensor1D, transform: ClassTransformation) {
    let clazz = await transform.inverse(tensor);
    if (clazz.startsWith("["))
      clazz = JSON.parse(clazz);
    this.input.value = clazz;
  }

  public async getTensor(transform: ClassTransformation): Promise<TF.Tensor> {
    let tensor = await transform.transform(this.input.value as string);
    return tensor;
  }

  render() {
    return html`<sl-select id="input" ?multiple=${this.multi} value=${this.classes[0]}>${this.classes.map(c => html`<sl-option value=${c}>${c}</sl-option>`)}</sl-select>`;
  }
}
