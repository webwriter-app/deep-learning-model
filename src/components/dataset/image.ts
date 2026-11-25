import { msg as sourceMsg } from "@lit/localize";
import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import { html, TemplateResult } from "lit";
import { ref } from 'lit/directives/ref.js';
import { until } from 'lit/directives/until.js';
import { FeatureSettings, FeatureTransformation, NonEmptyArray } from '../../model/dataset/feature';
import { str, type MsgFn } from '@lit/localize';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../model/tflib";
const tf = await getTF();

/**
* This is the transformation from string values to an image
*/
export default class ImageTransformation extends FeatureTransformation {
    static {
        this.registry.push({name: "Image Encoding", constructor:this});
    }

    private widthElement?: SlInput;
    private heightElement?: SlInput;

    /**
    * The constructor runs through the samples and registers the unique classes.
    */
    public constructor(samples: Array<any>, settings: FeatureSettings) {
        super("Image Encoding", samples, settings);

        if (!this.settings.shema)
            this.settings.shema = "binary";
        if (!this.settings.width)
            this.settings.width = 0;
        if (!this.settings.height)
            this.settings.height = 0;
        if (!this.settings.transform)
            this.settings.transform = "identity";

        let that = this;
        this.getRawImage(samples[0]).onload = function (e: Event) {
            let img = e.target as HTMLImageElement;
            if (that.settings.width == 0) {
                that.settings.width = img.width;
                if (that.widthElement) {
                    that.widthElement.value = String(img.width);
                }
            }

            if (that.settings.height == 0) {
                that.settings.height = img.height;
                if (that.heightElement) {
                    that.heightElement.value = String(img.height);
                    that.heightElement.max = img.height;
                }
            }
            if (that.widthElement && that.heightElement) {
                that.widthElement.max = img.width;
                that.heightElement.max = img.height;
            }
        }
    }

    public size() {
        let channels = 3;
        if (this.settings.transform == "grayscale")
            channels = 1;
        return [this.settings.width, this.settings.height, channels] as NonEmptyArray<number>;
    }

    public async transform(value: string | number[]): Promise<TF.Tensor3D> {
        let bytes: Uint8Array<ArrayBuffer>;

        if (typeof value == "string") {
            if (value.trim().startsWith("[")) {
                value = JSON.parse(value) as number[];
                bytes = new Uint8Array(value);
            } else {
                const binaryString = atob(value);
                bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
            }
        } else {
            bytes = new Uint8Array(value);
        }

        return await this.pngBinaryToTensor(bytes, this.settings.width, this.settings.height);
    }

    public getInputElement(id:string): TemplateResult {
        return html`<drawing-canvas id=${id} width=${this.settings.width} height=${this.settings.height}></drawing-canvas>`
    }

    public getOutputElement(id:string): TemplateResult {
        return html`<tensor-image id=${id}></tensor-image>`
    }

    public async inverse(tensor: TF.Tensor3D): Promise<string> {
        const [height, width, channels] = tensor.shape;
        if (channels !== 3 && channels !== 4) {
            throw new Error('Tensor must have 3 (RGB) or 4 (RGBA) channels');
        }

        const data = await tensor.data();
        const imageDataArray = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            imageDataArray[i * 4 + 0] = (data[i * channels + 0] || 0) * 255; // R
            imageDataArray[i * 4 + 1] = (data[i * channels + 1] || 0) * 255; // G
            imageDataArray[i * 4 + 2] = (data[i * channels + 2] || 0) * 255 // B
            imageDataArray[i * 4 + 3] = (channels === 4 ? data[i * channels + 3] : 1) * 255 // A
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const imageData = new ImageData(imageDataArray, width, height);
        ctx.putImageData(imageData, 0, 0);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = String(reader.result).split(',')[1];
                const binary = atob(base64);
                resolve(binary);
            };
            reader.readAsDataURL(blob!);
            }, 'image/png');
        });
    }

    async pngBinaryToTensor(pngBinary: Uint8Array<ArrayBuffer>, targetWidth: number, targetHeight: number) {
        let blob = new Blob([pngBinary], { type: 'image/png' });
        let bitmap = await createImageBitmap(blob);

        let tensor = tf.tidy(() => {
            let img = tf.browser.fromPixels(bitmap)
            .resizeBilinear([targetWidth, targetHeight])
            .toFloat()
            .div<TF.Tensor3D>(tf.scalar(255));
            if (this.settings.transform == "grayscale")
                img = tf.image.rgbToGrayscale(img);
            return img;
        });

        return tensor as TF.Tensor3D;
    }

    private transformImage(img: HTMLImageElement, width: number, height: number) {
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        let ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (this.settings.transform == "grayscale") {
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                let gray = 0.3 * r + 0.59 * g + 0.11 * b;

                data[i] = data[i + 1] = data[i + 2] = gray;
            }

            ctx.putImageData(imageData, 0, 0);
        }

        let outImg = document.createElement("img");
        outImg.src = canvas.toDataURL();
        return outImg;
    }

    public getSettingElement(changeCallback: (settings: FeatureSettings) => void, editMode:string, msg: MsgFn = sourceMsg): TemplateResult {
        let that = this;
        function typechange(e: Event) {
            let element = e.target as HTMLInputElement;
            let value: string | number = element.value;
            if (element.type == "number")
                value = parseFloat(value);
            that.settings[element.name] = value;
            changeCallback(that.settings);
        }

        return html`
        <sl-select name="shema" value=${this.settings.shema} @sl-change=${typechange} label=${msg("Import Format")} ?disabled=${editMode == "read"}>
            <sl-option value="binary">${msg("Binary String")}</sl-option>
            <sl-option value="base64">${msg("Base64 String")}</sl-option>
        </sl-select>
        <sl-input ${ref(element => { this.widthElement = element as SlInput | undefined; })} type="number" name="width" label=${msg("Width")} .value=${this.settings.width} .max=${this.settings.width} .min=${1} ?disabled=${editMode == "read"} @sl-change=${typechange}></sl-input>
        <sl-input ${ref(element => { this.heightElement = element as SlInput | undefined; })} type="number" name="height" label=${msg("Height")} .value=${this.settings.height} .max=${this.settings.height} .min=${1} ?disabled=${editMode == "read"} @sl-change=${typechange}></sl-input>
        <sl-select name="transform" value=${this.settings.transform} @sl-change=${typechange} label=${msg("Image Pre-Processing")} ?disabled=${editMode == "read"}>
            <sl-option value="identity">${msg("Identity")}</sl-option>
            <sl-option value="grayscale">${msg("Grayscale")}</sl-option>
        </sl-select>`;
    }

    public async getImage(value: string | number[]): Promise<HTMLImageElement> {
        let img = this.getRawImage(value);
        await (new Promise(function (res) {
            img.onload = res;
        }))
        let scaled = this.transformImage(img, this.settings.width, this.settings.height);
        return scaled;
    }

    public getRawImage(value: string | number[]): HTMLImageElement {
        let bytes: Uint8Array<ArrayBuffer>;

        if (typeof value == "string") {
            if (value.trim().startsWith("[")) {
                const parsedValue = JSON.parse(value) as number[];
                bytes = new Uint8Array(parsedValue);
            } else {
                const binaryString = atob(value);
                bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
            }
        } else {
            bytes = new Uint8Array(value);
        }

        let blob = new Blob([bytes], { type: 'image/png' });
        let imageUrl = URL.createObjectURL(blob);
        let img = new Image();
        img.src = imageUrl;
        return img;
    }

    private async waitUntilImageDimensionsAvailable() {
        let that = this;
        return new Promise(function (res) {
            let inter = setInterval(function () {
                if (that.settings.width != 0 && that.settings.height != 0) {
                    clearInterval(inter);
                    res(null);
                }
            }, 10);
        })
    }

    public renderPredictionDifference(pred:TF.Tensor3D, label:TF.Tensor3D, msg: MsgFn = sourceMsg) {
        return html`${until((async () => {
            let predValue = this.renderTransformedValue(await this.inverse(pred), msg);
            let labelValue = this.renderTransformedValue(await this.inverse(label), msg);
            return html`${msg(str`Prediction: ${predValue},  Label: ${labelValue}`)}`;
        })(), html`${msg("Visualizing Difference...")}`)}`;
    }

    public renderTransformedValue(value: string | number[], msg: MsgFn = sourceMsg): TemplateResult {
        return html`${until(
            (async () => {
                await this.waitUntilImageDimensionsAvailable();
                let img = await this.getImage(value);
                return img;
            })(),
            html`${msg("Loading image")}`)
            }`;
    }

    public renderOriginalValue(value: string | number[]): string {
        if (typeof value == "string") {
            if (value.trim().startsWith("[")) {
                // Old format: already in array string format
                return value;
            } else {
                // New format: base64 string
                const binaryString = atob(value);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                // Show only first 9 and last 3 bytes for readability
                const byteArray = Array.from(bytes);
                if (byteArray.length > 20) {
                    const first = byteArray.slice(0, 9);
                    const last = byteArray.slice(-3);
                    return `[${first.join(', ')}, ..., ${last.join(', ')}]`;
                }
                return JSON.stringify(byteArray);
            }
        } else {
            return JSON.stringify(value);
        }
    }
}