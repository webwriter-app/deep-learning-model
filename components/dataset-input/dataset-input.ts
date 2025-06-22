import { html, css, LitElement, PropertyValues } from "lit";

import { LitElementWw } from "@webwriter/lit";
import { customElement, property, query } from "lit/decorators.js";
import Papa from "papaparse";
import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet';

import {
  SlCheckbox,
  SlInput,
  SlIcon,
  SlButton,
} from "@shoelace-style/shoelace";
import "@shoelace-style/shoelace/dist/themes/light.css";

import styles from "./dataset-input.styles";

//Tabler
import worldWWW from "@tabler/icons/outline/world-www.svg";
import file from "@tabler/icons/outline/file.svg";

export class DatasetInput extends LitElementWw {

  /**
   * Returns an object that maps custom element names to their corresponding classes.
   * These custom elements can be used within the scope of the `webwriter-interactive-video` component.
   *
   * @returns An object mapping custom element names to their corresponding classes.
   */
  static get scopedElements() {
    return {
      "sl-checkbox": SlCheckbox,
      "sl-input": SlInput,
      "sl-icon": SlIcon,
      "sl-button": SlButton,
    };
  }

  //import CSS
  static styles = [styles];

  /*

  */

  firstUpdated() { }

  render() {
    return html` <div
      class="overlay"
      style="display: flex;
      flex-direction: column;"
    >
      <sl-button
        variant="default"
        style="width: 20%"
        @click=${this.triggerFileInput}
        @dragover=${this.handleDragOverFileInputArea}
        @drop=${this.handleDropOnFileInputArea}
      >
        <sl-icon slot="prefix" src=${file}></sl-icon>
        Select Dataset
        <input
          name="fileInput"
          id="fileInput"
          type="file"
          accept="text/csv, *"
          @change=${this.handleFileInput}
          style="display: none;"
        />
      </sl-button>
    </div>`;
  }

  async readParquetFile(file: File): Promise<Array<Record<string, any>>> {
    let url = URL.createObjectURL(file);
    let buffer = await asyncBufferFromUrl({ url, byteLength: file.size });
    let data = await parquetReadObjects({ file: buffer });
    return data;
  }
  async readCSVFile(file: File): Promise<Array<Record<string, any>>> {
    return new Promise(function (res, rej) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete: function (results) {
          res(results);
        }
      });
    });
  }


  triggerFileInput() {
    const fileInput =
      this.shadowRoot?.getElementById("fileInput") ||
      document.getElementById("fileInput");
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Handles the drag over event for the file input area.
   * @param e - The drag event.
   */
  handleDragOverFileInputArea(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handles the drop event on the file input area.
   *
   * @param e - The drag event.
   */
  handleDropOnFileInputArea(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  /**
   * Handles the file input event.
   *
   * @param e - The event object.
   */
  handleFileInput(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }


  /**
   * Handles the selected file and reads its contents and converts them into samples with keyed entries.
   * @param file - The file to be handled.
   */
  async handleFile(file: File) {
    let that = this;
    let data = null;
    if (file.name.endsWith("parquet")) {
      let content = await this.readParquetFile(file);
      let fields = Object.keys(content[0]);
      let errors = [];
      data = { data: content, errors, meta: { fields } };
    } else if (file.name.endsWith("csv")) {
      data = await this.readCSVFile(file);
    } else {
      console.error("Unsupported file type:", file.type);
    }
    this.dispatchEvent(
      new CustomEvent("readDataset", {
        detail: { ...data },
        bubbles: true,
        composed: true,
      })
    );
  }
}