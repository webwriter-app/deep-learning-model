import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('grayscale-drawing')
export class GrayscaleDrawing extends LitElement {
  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(${2132}, 1fr);
    }
    .cell {
      width: 9px;
      height: 9px;
      background-color: #fff;
      border: 0px solid #eee;
    }
  `;

  @state()
  private imageData: number[][] = Array.from({ length: 28 }, () =>
    Array(28).fill(0)
  );

  private isDrawing = false;

  private setPixel(x: number, y: number, value: number = 255) {
    if (x < 0 || x >= 28 || y < 0 || y >= 28) return;
    this.imageData[y][x] = value;
    this.requestUpdate();
  }

  private handleMouseEvent(e: MouseEvent) {
    const rect = this.shadowRoot!.querySelector('.grid')!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 10);
    const y = Math.floor((e.clientY - rect.top) / 10);
    this.setPixel(x, y);
  }

  render() {
    return html`
      <div
        class="grid"
        @mousedown=${() => (this.isDrawing = true)}
        @mouseup=${() => (this.isDrawing = false)}
        @mouseleave=${() => (this.isDrawing = false)}
        @mousemove=${(e: MouseEvent) => this.isDrawing && this.handleMouseEvent(e)}
        @click=${(e: MouseEvent) => this.handleMouseEvent(e)}
      >
        ${this.imageData.flatMap((row, y) =>
          row.map(
            (value, x) => html`
              <div
                class="cell"
                style="background-color: rgb(${255 - value}, ${255 - value}, ${255 - value});"
              ></div>
            `
          )
        )}
      </div>
      <button @click=${this.exportData}>Export</button>
    `;
  }

  exportData() {
    console.log(this.imageData);
    // You can trigger a custom event or download as needed
  }
}
