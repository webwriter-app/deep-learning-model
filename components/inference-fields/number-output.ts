import { SlRange } from "@shoelace-style/shoelace";
import { css, html, TemplateResult } from 'lit';
import LinearTransformation from '../../lib/dataset/linear';
import { OutputElement } from './inference-interfaces';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export class NumberOutput extends OutputElement {
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

  public async setTensor(tensor: TF.Tensor, transform: LinearTransformation) {
    let that = this;
    let probs = tf.tidy(() => {
        return tensor.squeeze();
    })
    let value = parseFloat(await transform.inverse(probs as TF.Tensor1D));
    that.input = html`<table><tr><td>${value.toFixed(3)}</td><td><sl-range min=${transform.aggrigatedInformation.min} max=${transform.aggrigatedInformation.max} value=${value} disabled></sl-range></td></tr></table>`
    this.requestUpdate();
  }

  render() {
    return html`${this.input}`;
  }
}