import { effectiveLanguage, localizeElement, nativeLanguageAttributes } from "../../localization/localizer";
import { html } from "lit";

import { LitElementWw } from "@webwriter/lit";
import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet';
import Papa from "papaparse";

import {
  SlButton,
  SlCheckbox,
  SlIcon,
  SlInput,
} from "@shoelace-style/shoelace";
import "@shoelace-style/shoelace/dist/themes/light.css";

import styles from "./dataset-input.styles";

//Tabler
import file from "@tabler/icons/outline/file.svg";

export class DatasetInput extends LitElementWw {
  static override get observedAttributes() { return nativeLanguageAttributes(this, super.observedAttributes); }

  override get lang(): string { return effectiveLanguage(this); }
  override set lang(value: string) { this.setAttribute("lang", value); }
  private readonly msg = localizeElement(this);

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
        ${this.msg("Select Dataset")}
        <input
          name="fileInput"
          id="fileInput"
          type="file"
          accept="text/csv, application/json, text/json, *"
          @change=${this.handleFileInput}
          style="display: none;"
        />
      </sl-button>
    </div>`;
  }

  private recursiveFlatten(obj, name) {
    if (obj == null)
      return null;
    if (obj.constructor == null || obj.constructor.name != "Object")
      return obj;

    let out = {};
    for (let field in obj) {
      let flattenedField = this.recursiveFlatten(obj[field], field);
      if (flattenedField == null)
        continue;
      if (flattenedField.constructor != null && flattenedField.constructor.name == "Object") {
        for (let flat in flattenedField) {
          out[name ? name + "_" + flat : flat] = flattenedField[flat];
        }
      } else {
        out[name ? name + "_" + field : field] = flattenedField;
      }
    }
    return out;
  }
  

  async readParquetFile(file: File): Promise<Array<Record<string, any>>> {
    let url = URL.createObjectURL(file);
    let buffer = await asyncBufferFromUrl({ url, byteLength: file.size });
    let data = await parquetReadObjects({ file: buffer, utf8: false });
    return data.map(entry => this.recursiveFlatten(entry, null));
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
  async readJSONFile(file: File): Promise<Array<Record<string, any>>> {
    return JSON.parse(await file.text());
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
      for (let row of content) {

      }
      let fields = Object.keys(content[0]);
      let errors = [];
      data = { data: content, errors, meta: { fields } };
    } else if (file.name.endsWith("csv")) {
      data = await this.readCSVFile(file);
    } else if (file.name.endsWith("json")) {
      data = {data: await this.readJSONFile(file)};
      data.meta = {fields:Object.keys(data.data[0])};
      data.errors = [];
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