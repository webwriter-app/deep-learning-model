import { LitElement, html, css, TemplateResult } from 'lit';
import { property, customElement, query } from 'lit/decorators.js';
import * as tf from '@tensorflow/tfjs';
import { LitElementWw } from '@webwriter/lit';
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput, SlProgressBar } from "@shoelace-style/shoelace"
import { InputElement, OutputElement } from './inference-interfaces';
import ClassTransformation from '../../lib/dataset/class';

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

  public async setTensor(tensor: tf.Tensor1D, transform: ClassTransformation) {
    let clazz = await transform.inverse(tensor);
    if (clazz.startsWith("["))
      clazz = JSON.parse(clazz);
    this.input.value = clazz.replaceAll(" ","_");
  }

  public async getTensor(transform: ClassTransformation): Promise<tf.Tensor> {
    let tensor = await transform.transform(this.input.value as string);
    return tensor;
  }

  render() {
    return html`<sl-select id="input" value=${this.classes[0]}>${this.classes.map(c => html`<sl-option value=${c}>${c}</sl-option>`)}</sl-select>`;
  }
}
