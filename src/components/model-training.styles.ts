import { css } from "lit";
import { hostStyles } from "./host.styles";

export default [hostStyles, css`
    :host {
      font-size: 0.9rem;
    }
    :host([contenteditable][editmode="hidden"]) {
      min-height: 30px;
      background:lightgray;
      font-size: inherit;
    }
    :host .controls {
        display:flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-content: center;
        justify-content: flex-start;
        align-items: flex-end;
        gap: 10px;
    }
    #error {
        color:red;
    }
    #error:before {
        content:"⚠";
    }
    #chart-box {
        height: 200px;
        position: relative;
    }
    @container (max-width: 520px) {
        .controls sl-button-group {
            flex: 1 1 100%;
        }
        .controls sl-button-group sl-button {
            flex: 1 1 0;
        }
        #metrics {
            width: 100%;
        }
    }
    @media print {
        :host([editmode="hidden"]) {
            display: none;
        }
        sl-button-group, #metrics {
            display: none;
        }
        #chart-box, #training-metrics p {
            break-inside: avoid;
        }
    }
    `];
