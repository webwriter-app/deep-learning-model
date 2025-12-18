import { SlInput } from '@shoelace-style/shoelace';
import { html, TemplateResult } from "lit";
import { until } from 'lit/directives/until.js';
import { FeatureSettings, FeatureTransformation, NonEmptyArray } from './feature';
import { msg, str } from '@lit/localize';

import type * as TF from "@tensorflow/tfjs";
import getTF from "../../lib/tflib";
let tf: typeof TF;
(async () => {tf = await getTF()})()

/**
* This is the transformation from string values to an image
*/
export default class ImageTransformation extends FeatureTransformation {
    static {
        this.registry.push({name: "Image Encoding", constructor:this});
    }

    private widthElement: SlInput;
    private heightElement: SlInput;

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
        this.getRawImage(samples[0] as number[]).onload = function (e: Event) {
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
        if (typeof value == "string")
            value = JSON.parse(value) as number[];

        return await this.pngBinaryToTensor(new Uint8Array(value), this.settings.width, this.settings.height);
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
        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(imageDataArray, width, height);
        ctx.putImageData(imageData, 0, 0);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.toString().split(',')[1];
                const binary = atob(base64);
                resolve(binary);
            };
            reader.readAsDataURL(blob);
            }, 'image/png');
        });
    }

    async pngBinaryToTensor(pngBinary, targetWidth, targetHeight) {
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

        let ctx = canvas.getContext('2d');
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

    public getSettingElement(changeCallback, editMode:string): TemplateResult {
        let that = this;
        function typechange(e: Event) {
            let element = e.target as HTMLInputElement;
            let value: string | number = element.value;
            if (element.type == "number")
                value = parseFloat(value);
            that.settings[element.name] = value;
            changeCallback(that.settings);
        }

        //This is needed because the global sl-input class is broken...
        this.widthElement = document.createElement("sl-input");
        this.widthElement.type = "number"
        this.widthElement.label = msg("Width");
        this.widthElement.value = this.settings.width;
        this.widthElement.addEventListener("sl-change", typechange);
        this.widthElement.max = this.settings.width;
        this.widthElement.min = 1;
        this.widthElement.name = "width";
        this.widthElement.disabled = editMode == "read"

        this.heightElement = document.createElement("sl-input");
        this.heightElement.type = "number"
        this.heightElement.label = msg("Height");
        this.heightElement.value = this.settings.height;
        this.heightElement.addEventListener("sl-change", typechange);
        this.heightElement.max = this.settings.height;
        this.heightElement.min = 1;
        this.heightElement.name = "height";
        this.heightElement.disabled = editMode == "read"

        return html`
        <sl-select name="shema" value=${this.settings.shema} @sl-change=${typechange} label=${msg("Import Format")} ?disabled=${editMode == "read"}>
            <sl-option value="binary">${msg("Binary String")}</sl-option>
            <sl-option value="base64">${msg("Base64 String")}</sl-option>
        </sl-select>
        ${this.widthElement}${this.heightElement}
        <sl-select name="transform" value=${this.settings.transform} @sl-change=${typechange} label=${msg("Image Pre-Processing")} ?disabled=${editMode == "read"}>
            <sl-option value="identity">${msg("Identity")}</sl-option>
            <sl-option value="grayscale">${msg("Grayscale")}</sl-option>
        </sl-select>`;
    }

    public async getImage(value: number[]): Promise<HTMLImageElement> {
        let img = this.getRawImage(value);
        await (new Promise(function (res, rej) {
            img.onload = res;
        }))
        let scaled = this.transformImage(img, this.settings.width, this.settings.height);
        return scaled;
    }

    public getRawImage(value: number[]): HTMLImageElement {
        let bytes = new Uint8Array(value);
        let blob = new Blob([bytes], { type: 'image/png' });
        let imageUrl = URL.createObjectURL(blob);
        let img = new Image();
        img.src = imageUrl;
        return img;
    }

    private async waitUntilImageDimensionsAvailable() {
        let that = this;
        return new Promise(function (res, rej) {
            let inter = setInterval(function () {
                if (that.settings.width != 0 && that.settings.height != 0) {
                    clearInterval(inter);
                    res(null);
                }
            }, 10);
        })
    }

    public renderPredictionDifference(pred:TF.Tensor3D, label:TF.Tensor3D) {
        return html`${until((async () => {
            let predValue = this.renderTransformedValue(await this.inverse(pred));
            let labelValue = this.renderTransformedValue(await this.inverse(label));
            return html`${msg(str`Prediction: ${predValue},  Label: ${labelValue}`)}`;
        })(), html`${msg("Visualizing Difference...")}`)}`;
    }

    public renderTransformedValue(value: string | number[]): TemplateResult {
        return html`${until(
            (async () => {
                await this.waitUntilImageDimensionsAvailable();
                if (typeof value == "string")
                    value = JSON.parse(value) as number[];
                let img = await this.getImage(value);
                return img;
            })(),
            html`${msg("Loading image")}`)
            }`;
    }
}