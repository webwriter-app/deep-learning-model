import { LitElement, html, css, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import * as tf from '@tensorflow/tfjs';
import { LitElementWw } from '@webwriter/lit';
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput, SlProgressBar,SlRange } from "@shoelace-style/shoelace"
import { InputElement, OutputElement } from './inference-interfaces';
import LinearTransformation from '../../lib/dataset/linear';

export class NumberInput extends OutputElement {
    static scopedElements = {
        "sl-range": SlRange
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
    sl-range {
        --track-color-active: var(--sl-color-primary-600);
        --track-color-inactive: var(--sl-color-primary-100);
    }
  `;

  private input: TemplateResult;

  public async setTensor(tensor: tf.Tensor, transform: LinearTransformation) {
    let that = this;
    let probs = tf.tidy(() => {
        return tensor.squeeze();
    })
    let value = parseFloat(await transform.inverse(probs as tf.Tensor1D));
    let valueP = document.createElement("p");
    valueP.innerText = value.toFixed(3);
    that.input = html`<table><tr><td>${valueP}</td><td><sl-range step="0.01" id="input" min=${transform.aggrigatedInformation.min} max=${transform.aggrigatedInformation.max} value=${value} @sl-input=${(e: Event) => valueP.innerText = (e.target as SlRange).value.toFixed(3)}></sl-range></td></tr></table>`
    this.requestUpdate();
  }
  public async getTensor(transform: LinearTransformation) {
    let value = (this.shadowRoot.getElementById("input") as SlRange).value;
    return transform.transform(String(value));
  }

  render() {
    return html`${this.input}`;
  }
}