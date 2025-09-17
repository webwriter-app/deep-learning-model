import { LitElement, html, css } from 'lit';
import { property, customElement, query } from 'lit/decorators.js';
import { LitElementWw } from '@webwriter/lit';
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import { InputElement, OutputElement } from './inference-interfaces';
import ImageTransformation from '../../lib/dataset/image';

import getTF from "../../lib/tflib";
import type * as TF from "@tensorflow/tfjs";
let tf: typeof import("/home/spakkel/Dokumente/ai-blocks/node_modules/@tensorflow/tfjs");
(async () => {tf = await getTF()})()

export class TensorImage extends OutputElement {
    static scopedElements = {}

  static styles = css`
    :host {
      position: relative;
      display: inline-block;
      touch-action: none;
    }
    canvas {
      background: white;
      border: 1px solid #ccc;
      touch-action: none;
      image-rendering: pixelated; /* Makes low-res canvas look better */
      min-width: 200px;
      min-height: 200px;
    }
    sl-button {
      position: absolute;
      top: 0px;
      left: 0px;
    }
  `;

  @query("#img")
  accessor image: HTMLCanvasElement;

  public async setTensor(tensor: TF.Tensor3D, transform: ImageTransformation) {
      tf.tidy(() => {
        tensor = tensor.squeeze();
        const [height, width, channels] = tensor.shape;

        const data = tensor.dataSync();
        const imageDataArray = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            if (channels == 4) {
              imageDataArray[i * 4 + 0] = (data[i * channels + 0] || 0) * 255; // R
              imageDataArray[i * 4 + 1] = (data[i * channels + 1] || 0) * 255; // G
              imageDataArray[i * 4 + 2] = (data[i * channels + 2] || 0) * 255 // B
              imageDataArray[i * 4 + 3] = (data[i * channels + 3] || 0) * 255 // A
            } else if (channels == 3) {
              imageDataArray[i * 4 + 0] = (data[i * channels + 0] || 0) * 255; // R
              imageDataArray[i * 4 + 1] = (data[i * channels + 1] || 0) * 255; // G
              imageDataArray[i * 4 + 2] = (data[i * channels + 2] || 0) * 255 // B
              imageDataArray[i * 4 + 3] = 255 // A
            } else if (channels == 2) {
              imageDataArray[i * 4 + 0] = (data[i * channels + 0] || 0) * 255; // R
              imageDataArray[i * 4 + 1] = (data[i * channels + 1] || 0) * 255; // G
              imageDataArray[i * 4 + 2] = 0 // B
              imageDataArray[i * 4 + 3] = 255 // A
            } else if (channels == 1 || channels == null) {
              let gray = (data[i] || 0) * 255;
              imageDataArray[i * 4 + 0] = gray; // R
              imageDataArray[i * 4 + 1] = gray; // G
              imageDataArray[i * 4 + 2] = gray; // B
              imageDataArray[i * 4 + 3] = 255; // A
            }
        }

        const canvas = this.image;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(imageDataArray, width, height);
        ctx.putImageData(imageData, 0, 0);
      })
  }

  render() {
    return html`<canvas id="img"></canvas>`;
  }
}
