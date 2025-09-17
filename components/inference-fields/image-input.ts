import { LitElement, html, css } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { LitElementWw } from '@webwriter/lit';
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import { InputElement } from './inference-interfaces';

import getTF from "../../lib/tflib";
import type * as TF from "@tensorflow/tfjs";
let tf: typeof import("/home/spakkel/Dokumente/ai-blocks/node_modules/@tensorflow/tfjs");
(async () => {tf = await getTF()})()

export class DrawingCanvas extends InputElement {
    static scopedElements = {
        "sl-button": SlButton
    }
    
  @property({ type: Number }) width = 20;
  @property({ type: Number }) height = 20;

  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private isDrawing = false;
  private points: { x: number; y: number }[] = [];

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
    }
    sl-button {
      position: absolute;
      top: 0px;
      left: 0px;
    }
  `;

  updated() {
    if (this.canvas) {
      const w = this.width;
      const h = this.height;

      // Internal resolution
      this.canvas.width = w;
      this.canvas.height = h;

      // Visual size (CSS) — scaled to at least 200px
      const scale = Math.max(200 / w, 200 / h);
      this.canvas.style.width = `${w * scale}px`;
      this.canvas.style.height = `${h * scale}px`;

      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'black';
    }
  }

  firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas')!;
    this.addEventListeners();
    this.updated(); // apply dimensions
  }

  private addEventListeners() {
    const getCanvasCoords = (clientX: number, clientY: number) => {
      const rect = this.canvas!.getBoundingClientRect();
      const scaleX = this.canvas!.width / rect.width;
      const scaleY = this.canvas!.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const start = (x: number, y: number) => {
      this.isDrawing = true;
      this.points = [{ x, y }];
    };
    const move = (x: number, y: number) => {
      if (!this.isDrawing) return;
      this.points.push({ x, y });
      this.redraw();
    };
    const end = () => {
      this.isDrawing = false;
      this.points = [];
    };

    this.canvas!.addEventListener('mousedown', e => {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      start(x, y);
    });
    this.canvas!.addEventListener('mousemove', e => {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      move(x, y);
    });
    this.canvas!.addEventListener('mouseup', end);
    this.canvas!.addEventListener('mouseleave', end);

    this.canvas!.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
      start(x, y);
    });
    this.canvas!.addEventListener('touchmove', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
      move(x, y);
    });
    this.canvas!.addEventListener('touchend', end);
  }

  private redraw() {
    if (!this.ctx || this.points.length < 2) return;
    const ctx = this.ctx;
    const [p1, p2] = this.points.slice(-2);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  public clear() {
    this.ctx!.fillStyle = "#ffffff";
    this.ctx?.fillRect(0, 0, this.canvas!.width, this.canvas!.height);
  }

  public async getTensor(): Promise<TF.Tensor<TF.Rank>> {
    const imgData = this.ctx!.getImageData(0, 0, this.canvas!.width, this.canvas!.height);
    const grayData = new Float32Array(this.canvas!.width * this.canvas!.height);
    for (let i = 0; i < grayData.length; i++) {
      const r = imgData.data[i * 4];
      const g = imgData.data[i * 4 + 1];
      const b = imgData.data[i * 4 + 2];
      const avg = (r + g + b) / 3;
      grayData[i] = (255 - avg) / 255;
    }
    return tf.tensor(grayData, [this.canvas!.width, this.canvas!.height, 1]);
  }

  public async setTensor(tensor: TF.Tensor) {
    const [h, w, c] = tensor.shape;

    if (c !== 1) {
      throw new Error('Tensor must have shape [height, width, 1]');
    }

    if (!this.canvas || !this.ctx) return;

    // Update internal resolution and re-render canvas
    this.width = w;
    this.height = h;
    await this.updateComplete; // Wait for Lit to apply changes

    const imageData = this.ctx.createImageData(w, h);
    const data = await tensor.data();

    for (let i = 0; i < w * h; i++) {
      const v = 255 - Math.floor(data[i] * 255); // invert normalization
      imageData.data[i * 4 + 0] = v;
      imageData.data[i * 4 + 1] = v;
      imageData.data[i * 4 + 2] = v;
      imageData.data[i * 4 + 3] = 255;
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  render() {
    return html`<canvas></canvas><sl-button @click=${this.clear}>Clear</sl-button>`;
  }
}
