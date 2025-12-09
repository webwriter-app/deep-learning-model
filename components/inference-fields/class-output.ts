import { SlProgressBar } from "@shoelace-style/shoelace";
import { css, html, TemplateResult } from 'lit';
import ClassTransformation from '../../lib/dataset/class';
import { OutputElement } from './inference-interfaces';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

export class ClassTable extends OutputElement {
    static scopedElements = {
        "sl-progress-bar": SlProgressBar
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

  private table: TemplateResult;

  public async setTensor(tensor: TF.Tensor, transform: ClassTransformation) {
    let probs = tf.tidy(() => {
      return tensor.clipByValue(0,1).squeeze().arraySync();
    })
    let entries = [];
    let classes = transform.getClasses();
    for (let i = 0; i < classes.length; i++) {
        entries.push({prob: probs[i], clazz: classes[i]});
    }
    entries.sort((e1, e2) => e2.prob - e1.prob);
    entries = entries.slice(0, 10);

    let rows = [];
    for (let e of entries) {
        rows.push(html`<tr><td class="class">${e.clazz}</td><td><sl-progress-bar value=${e.prob * 100} title=${e.clazz + " (" + (e.prob * 100).toFixed(1) + "%)"}></sl-progress-bar></td></tr>`)
    }
    this.table = html`<table>${rows}</table>`
    this.requestUpdate();
  }

  render() {
    return html`${this.table}`;
  }
}
