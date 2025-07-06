import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import { Dataset, TransformedDataset, FeatureTransformation, getFeatureTransformations, getFeatureTransformation } from "../lib/types/dataset"
import * as tf from '@tensorflow/tfjs';
import { setupLayerRenderer } from "../lib/types/layers"
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import { AiWidgetsReferenceSelect } from "../components/refference-element-select"
import { AiWidgetsFeatures } from "./webwriter-features"
import { AiWidgetsDesigns } from "./webwriter-design";
import ApexCharts from "apexcharts";
import {setWasmPaths} from '@tensorflow/tfjs-backend-wasm';
import { Editor, Layer } from "../lib/layers";
setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');

class NoOpLayer extends tf.layers.Layer {
  constructor(config) {
    super(config);
    this.supportsMasking = true;
  }

  call(inputs, kwargs) {
    return inputs;
  }

  computeOutputShape(inputShape) {
    return inputShape;
  }

  static get className() {
    return 'NoOpLayer';
  }
}

tf.serialization.registerClass(NoOpLayer);


@customElement("webwriter-training")
export class AiWidgetsTraining extends LitElementWw {
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-input":SlInput,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton,
        "ref-select": AiWidgetsReferenceSelect
    }


    static styles = css`
    :host {
      min-height: 200px;
      display:block;
      font-size: 0.9rem;
    }
    :host .controls {
        display:flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-content: center;
        justify-content: flex-start;
        align-items: flex-end;
        gap: 10px;
    }`

    @property({ type: String, attribute: true, reflect: true })
    accessor optimizer: string;

    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;
    private featureSelect = document.createElement("ref-select") as AiWidgetsReferenceSelect;

    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;
    private modelSelect = document.createElement("ref-select") as AiWidgetsReferenceSelect;

    constructor() {
        super();
        let that = this;
        setTimeout(function () {
            that.featureSelect["element-type"] = "webwriter-features";
            that.featureSelect.elemId = that.featureWidgetId;
            that.featureSelect.addEventListener("refchange", function (e: CustomEvent) {
                that.featureWidgetId = e.detail.id;
            })

            that.modelSelect["element-type"] = "webwriter-design";
            that.modelSelect.elemId = that.modelWidgetId;
            that.modelSelect.addEventListener("refchange", function (e: CustomEvent) {
                that.modelWidgetId = e.detail.id;
            })
        }, 0)
        this.startTrainingBtn.innerText = "Start training";
        this.startTrainingBtn.addEventListener("click", function () {
            that.training();
        })
        this.resetTrainingBtn.innerText = "Reset";
        this.resetTrainingBtn.addEventListener("click", function () {
            that.resetModel();
        })
        this.speed.innerText = "0";

        setInterval(function() {
            that.memory.innerText = (tf.memory().numBytes / 1024 / 1024).toFixed(2);
        }, 50) 
    }

    public options: Record<string, OptionDeclaration> = {}
    private startTrainingBtn = document.createElement("sl-button");
    private resetTrainingBtn = document.createElement("sl-button");
    private speed = document.createElement("span");
    private memory = document.createElement("span");

    public render(): TemplateResult {
        let that = this;
        setTimeout(function () { that.chart.render() }, 100);
        return html`
            <div class="controls">
                <sl-input id="lr" type="number" label="Learning Rate" min="0.0001" max="0.01" value="0.005" size="small" style="max-width:100px"></sl-input>
                <sl-input id="epochs" type="number" label="Epochs" min="1" max="500" value="20" size="small" style="max-width:100px"></sl-input>
                <sl-button-group>
                ${this.startTrainingBtn}
                ${this.resetTrainingBtn}
                </sl-button-group>
            </div>
            ${this.chartContainer}
            <p>${this.speed}s/epoch\ \ \ ${this.memory}MB</p>
            <div part="options">
                <p>Feature Source</p>
                ${this.featureSelect}
                <p>Model Source</p>
                ${this.modelSelect}
            </div>`
    }

    private chartContainer = document.createElement("div")
    private losses: Record<string, Array<number>> = {};
    private insights: Record<string, any> = {min_val_loss: 100, min_val_loss_index: 0}; 
    private chart = new ApexCharts(this.chartContainer, {
        series: [],
        chart: {
            id: 'realtime',
            height: 350,
            type: 'line',
            animations: {
                enabled: false
            },
            toolbar: {
                show: false
            },
            zoom: {
                enabled: false
            }
        },
        dataLabels: {
            enabled: false
        },
        title: {
            text: 'Training Loss',
            align: 'left'
        },
        markers: {
            size: 0
        },
        xaxis: {
            type: 'number'
        },
        yaxis: {
            min: 0
        },
        legend: {
            show: false
        },
    });


    resolveOutput(layer: Layer, inputs: Record<string, tf.SymbolicTensor>, resolvedLayers: Record<number, any>): tf.SymbolicTensor {
        let visitedLayersInThisPath = [];

        function resolveLayer(layer: Layer, input_layers: Record<string, tf.SymbolicTensor>): Record<string, tf.SymbolicTensor> {
            console.log("resolve", layer);
            if (resolvedLayers[layer.id] != null)
                return resolvedLayers[layer.id];

            let outputTensor = layer.forward(input_layers)
            resolvedLayers[layer.id] = outputTensor;
            return outputTensor;
        }

        function resolveDependencies(layer:Layer) {
            if (layer.getState().type == "input") {
                return resolveLayer(layer, inputs);
            } else {
                let input_layers = {};
                let layers = layer.getInputLayers();
                for (let input in layers) {
                    let resolvedLayer = resolveDependencies(layers[input].outputOfLayer)
                    input_layers[input] = resolvedLayer[layers[input].outputField];
                }
                return resolveLayer(layer, input_layers);
            }
        }

        return new NoOpLayer({name: "out_" + layer.getState().select}).apply(resolveDependencies(Object.values(layer.getInputLayers())[0].outputOfLayer).output_1) as tf.SymbolicTensor;
    }
    async buildModel() {
        let model = (this.modelSelect.getRefElement() as AiWidgetsDesigns).getModel();
        let dataset = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset().tensorDataset;

        let editor = new Editor(document.createElement("div"));
        await editor.import(model, dataset)

        let inputs: Record<string, tf.SymbolicTensor> = {};
        for (let input_node of model.filter(l => l.type == "input")) {
            let shape = dataset.featureMaps[input_node.select].size();
            inputs[input_node.select] = tf.input({ shape: shape , name:"in_" + input_node.select});
        }

        let outputs: Record<string, tf.SymbolicTensor> = {};
        let resolvedLayers = {};
        for (let output of editor.getOutputs()) {
            outputs[output.getState().select] = this.resolveOutput(output, inputs, resolvedLayers);
        }

        return tf.model({ inputs: Object.values(inputs), outputs: Object.values(outputs) })
    }

    private isTraining = false;
    private currentTraining: tf.LayersModel;
    private currentEpoch: number;
    async resetModel() {
        if (this.isTraining)
            return;

        this.losses = {}
        this.currentEpoch = 0;
        this.insights = {min_val_loss: 100, min_val_loss_index: 0}; 

        await tf.setBackend('webgl'); // cpu, webgl, wasm
        await tf.ready();
        let model = await this.buildModel();
        this.currentTraining = model;
        model.compile({
            optimizer: tf.train.adam(parseFloat((this.shadowRoot.getElementById("lr") as SlInput).value)),
            loss: tf.metrics.binaryCrossentropy,
            metrics: ['accuracy'],
        });
        model.summary();
        console.log(model.toJSON());
        this.chart.removeAnnotation("lowest");
        this.startTrainingBtn.innerText = "Start Training";
    }
    async training() {
        if (this.currentTraining != null && this.isTraining) {
            this.currentTraining.stopTraining = true;
            this.isTraining = false;
            console.log("stop training")
            return;
        }

        if (this.currentTraining == null) {
            await this.resetModel();
        }

        this.startTrainingBtn.innerText = "Stop Training";

        if (this.currentTraining != null && !this.isTraining) {
            this.isTraining = true;
            this.resetTrainingBtn.disabled = true;
            let dataset = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset().tensorDataset;
            let batchSamples = [];
            let batchOutputs = [];
            //let samples = (await dataset.getValidationSamples()).slice(0, 1024);
            /*let samples = [];
            for (let i = 0; i < dataset.length(); i++) {
                samples.push(await dataset.getSample(i));
            }


            for (let i = 0; i < samples.length; i++) {
                let sample = samples[i];
                batchSamples.push(sample.image_bytes.arraySync())
                let label = sample.label.arraySync()
                batchOutputs.push(label)
            }
            let batch = tf.tensor(batchSamples, [samples.length, 28, 28, 1]);
            let batchOut = tf.tensor(batchOutputs, [samples.length, 10]);
            const xTrain = batch
            const yTrain = batchOut.transpose([0, 1]);*/

            let model = (this.modelSelect.getRefElement() as AiWidgetsDesigns).getModel();
            let inputNames: Set<string> = new Set();
            let i = 0;
            for (let input_node of model.filter(l => l.type == "input"))
                inputNames.add(input_node.select)

            let outputNames: Set<string> = new Set();
            for (let output_node of model.filter(l => l.type == "output"))
                outputNames.add(output_node.select);


            function getInputsAndOutputs(sample) {
                let inputs = {};
                let outputs = {};
                for (let f in sample) {
                    if (inputNames.has(f))
                        inputs["in_" + f] = sample[f];
                    if (outputNames.has(f))
                        outputs["out_" + f] = sample[f];
                }
                return {inputs, outputs};
            }

            async function* dataGenerator() {
                const numElements = dataset.dataset.trainingEnd;
                let index = 0;
                while (index < numElements) {
                    const sample = await dataset.getSample(index);
                    let {inputs, outputs} = getInputsAndOutputs(sample);
                    yield {xs:inputs, ys: outputs};
                    index++;
                }
                console.log("done");
            }

            const tfDataset = tf.data.generator(dataGenerator).batch(16).prefetch(4)

            async function* valdataGenerator() {
                const numElements = dataset.dataset.validationEnd;
                let index = dataset.dataset.trainingEnd;
                while (index < numElements) {
                    const sample = await dataset.getSample(index);
                    let {inputs, outputs} = getInputsAndOutputs(sample);
                    yield {xs:inputs, ys: outputs};
                    index++;
                }
            }

            const valDataset = tf.data.generator(valdataGenerator).batch(16).prefetch(4)

            let lastEpoch = Date.now();
            let numEpochs = parseInt((this.shadowRoot.getElementById("epochs") as SlInput).value);

            /*await this.currentTraining.fit(xTrain, yTrain, {
                epochs: 20,
                batchSize: 2,
                validationSplit: 0.1,*/
              
            await this.currentTraining.fitDataset(tfDataset, {
                epochs: this.currentEpoch + numEpochs + 1,
                validationData: valDataset,
                initialEpoch: this.currentEpoch + 1,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        if (this.currentTraining.stopTraining == true)
                            return;
                        for (let loss in logs) {
                            if (this.losses[loss] == null)
                                this.losses[loss] = [];
                            this.losses[loss].push(Math.round(logs[loss] * 1000) / 1000);
                            if (loss == "val_loss" && logs[loss] < this.insights.min_val_loss ) {
                                this.insights.min_val_loss = logs[loss];
                                this.insights.min_val_loss_index = epoch;
                            }
                        }
                        this.chart.updateSeries(
                            Object.entries(this.losses).map(
                                function ([k, v]) { return { name: k, data: v } }
                            )
                        )
                        this.chart.removeAnnotation("lowest");
                        this.chart.addPointAnnotation({
                            id: "lowest",
                            x: this.insights.min_val_loss_index,
                            y: this.insights.min_val_loss,
                            label: {
                                text: "Lowest",
                                style: {
                                background: "#FF4560",
                                color: "#fff"
                                }
                            },
                            marker: {
                                size: 6,
                                fillColor: "#fff",
                                strokeColor: "#FF4560"
                            }
                        })
                        this.currentEpoch = epoch;

                        this.speed.innerText = (((Date.now() - lastEpoch) / 1000) * 0.7 + parseFloat(this.speed.innerText) * 0.3).toFixed(2);
                        lastEpoch = Date.now();
                    }
                }
            });
            this.resetTrainingBtn.disabled = false;
            this.currentTraining.stopTraining = false;
            this.startTrainingBtn.innerText = "Continue Training";
            this.isTraining = false;
        }
    }
    disconnectedCallback(): void {
        tf.backend().dispose();
        tf.dispose();
    }
}
