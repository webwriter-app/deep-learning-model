import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { html, css, TemplateResult, PropertyValues, unsafeCSS } from "lit"
import { LitElementWw, OptionDeclaration, ActionDeclaration } from "@webwriter/lit"
import { customElement, property, state, query } from "lit/decorators.js"
import * as tf from '@tensorflow/tfjs';
import Drawflow from "drawflow";
import { SlIcon, SlButtonGroup, SlButton, SlSelect, SlOption, SlIconButton, SlInput } from "@shoelace-style/shoelace"
import { AiWidgetsReferenceSelect } from "../components/refference-element-select"
import { AiWidgetsFeatures } from "./webwriter-features"
import { AiWidgetsDesigns } from "./webwriter-design";
import ApexCharts from "apexcharts";
//import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { Editor, Layer } from "../lib/layers";
//setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
//setThreadsCount(4);

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
    accessor featureWidgetId: string;

    @query('#feature-select')
    accessor featureSelect;

    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;

    @query('#design-select')
    accessor modelSelect;

    @query('#start-training')
    accessor startTrainingBtn;

    @query('#reset-training')
    accessor resetTrainingBtn;

    @query('#training-metrics')
    accessor trainingMetricsDiv;

    @query("#speed")
    accessor speed:HTMLSpanElement;

    @query("#memory")
    accessor memory:HTMLSpanElement;

    constructor() {
        super();
        let that = this;
        setInterval(function() {
            try {
            that.memory.innerText = (tf.memory().numBytes / 1024 / 1024).toFixed(2);
            } catch(e) {}
        }, 50) 
    }

    public options: Record<string, OptionDeclaration> = {}
    public render(): TemplateResult {
        let that = this;
        setTimeout(function () { that.chart.render() }, 100);
        return html`
            <div class="controls">
                <sl-select id="optimizer" value="adam" label="Optimizer" size="small" @sl-change=${this.changeOptimizer}>
                    <sl-option value="adam">Adam</sl-option>
                    <sl-option value="momentum">Momentum</sl-option>
                    <sl-option value="rmsprop">RMSProp</sl-option>
                    <sl-option value="sgd">SGD</sl-option>
                </sl-select>
                <sl-input id="lr" type="number" label="Learning Rate" min="0.0001" max="0.01" value="0.002" step="0.0005" size="small" style="max-width:100px"></sl-input>
                <sl-input style="display:none" id="momentum" type="number" label="Momentum" min="0.1" max="0.99" value="0.9" size="small" style="max-width:100px"></sl-input>
                <sl-input id="batch" type="number" label="Batch Size" min="1" max="512" value="128" step="1" size="small" style="max-width:100px"></sl-input>
                <sl-input id="epochs" type="number" label="Epochs" min="1" max="500" value="20" size="small" style="max-width:100px"></sl-input>
                <sl-button-group>
                <sl-button id="start-training" @click=${this.training}>Start training</sl-button>
                <sl-button id="reset-training" @click=${this.resetModel}>Reset</sl-button>
                </sl-button-group>
            </div>
            <div id="training-metrics" style="display:none">
                ${this.chartContainer}
                <sl-select id="metrics" value="Loss Accuracy" multiple clearable @sl-change=${this.updateGraph}>
                    <sl-option value="Loss">Loss</sl-option>
                    <sl-option value="Accuracy">Accuracy</sl-option>
                    <sl-option value="R2_Score">R2 Score</sl-option>
                    <sl-option value="Percision">Precision</sl-option>
                    <sl-option value="Recall">Recall</sl-option>
                </sl-select>
                <p style="margin:0px">Training Speed:<span id="speed">0</span>s/epoch&nbsp;&nbsp;&nbsp;&nbsp;Used Tensor Memory:<span id="memory"></span>MB</p>
            </div>
            <div part="options">
                <p>Feature Source</p>
                <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-features" @refchange=${(e) => this.featureWidgetId = e.detail.id}></ref-select>
                <p>Design Source</p>
                <ref-select id="design-select" typeName="Design" elemId=${this.modelWidgetId} elementType="webwriter-design" @refchange=${(e) => this.modelWidgetId = e.detail.id}></ref-select>
            </div>`
    }

    changeOptimizer() {
        let optimizer = (this.shadowRoot.getElementById("optimizer") as SlSelect).value as string;
        if (optimizer == "momentum") {
            this.shadowRoot.getElementById("momentum").style.display = "";
        } else {
            this.shadowRoot.getElementById("momentum").style.display = "none";
        }
    }

    setHyperParamsActive(active:boolean) {
        (this.shadowRoot.getElementById("optimizer") as SlSelect).disabled = !active;
        (this.shadowRoot.getElementById("lr") as SlInput).disabled = !active;
        (this.shadowRoot.getElementById("momentum") as SlInput).disabled = !active;
        (this.shadowRoot.getElementById("batch") as SlInput).disabled = !active;
    }

    private chartContainer = document.createElement("div")
    private losses: Record<string, Array<number>> = {};
    private insights: Record<string, any> = {min_val_loss: 100, min_val_loss_index: 0}; 
    private chart = new ApexCharts(this.chartContainer, {
        series: [],
        chart: {
            id: 'realtime',
            height: 200,
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
            text: 'Training Metrics',
            align: 'left'
        },
        markers: {
            size: 0
        },
        xaxis: {
            type: 'number',
            labels: {
                rotate: -90,
                tickAmount: 10,
                hideOverlappingLabels: true,
                step: 5
            }
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
        let losses = {};
        for (let output of editor.getOutputs()) {
            outputs[output.getState().select] = this.resolveOutput(output, inputs, resolvedLayers);
            losses["out_" + output.getState().select] = this.lossStringToFunction(output.getState().loss);
        }


        return {model:tf.model({ inputs: Object.values(inputs), outputs: Object.values(outputs) }), losses}
    }

    lossStringToFunction(loss: string) {
        switch(loss) {
            case "BCE": return tf.metrics.binaryCrossentropy;
            case "MAE": return tf.metrics.meanAbsoluteError;
            case "Huber": return tf.losses.huberLoss;
            case "MSE": return tf.metrics.meanSquaredError;
            case "Difference": return  tf.losses.absoluteDifference;
            case "WL": return  tf.losses.computeWeightedLoss;
            case "CosDist": return  tf.losses.cosineDistance;
        }
    }

    updateGraph() {
        let metrics = (this.shadowRoot.getElementById("metrics") as SlSelect).value as string[]
        this.chart.updateSeries(
            Object.entries(this.losses).map(
                function ([k, v]) { return { name: k, data: v } }
            ).filter(e => metrics.indexOf(e.name.replace("Training_","").replace("Validation_", "")) != -1)
        )
    }

    public async getModel(name) {
        const model = await tf.loadLayersModel(name);
        return model;
    }

    public async getAvailableModels() {
        const models = await tf.io.listModels();
        return models;
    }

    private async clearModels() {
        const models = await tf.io.listModels();
        const deletions = Object.keys(models)
            .filter(key => key.startsWith('indexeddb://'))
            .map(key => tf.io.removeModel(key));
        await Promise.all(deletions);
        this.dispatchEvent(new CustomEvent('finished', {detail: {}}));
    }

    private isTraining = false;
    private currentTraining: tf.LayersModel;
    private currentEpoch = 0;
    private backendPriority = ["webgl","wasm","cpu"];
    private currentBackend = "webgl";
    private resetModel() {
        this.trainingMetricsDiv.style.display = "none";
        this.currentBackend = this.backendPriority[0];
        if (this.currentTraining)
            this.currentTraining.dispose();
        this.currentTraining = null;
        this.clearModels();
        this.losses = {}
        this.currentEpoch = 0;
        this.insights = {min_val_loss: 100, min_val_loss_index: 0}; 
        this.chart.removeAnnotation("best");
        this.updateGraph();
        this.setHyperParamsActive(true);
        this.startTrainingBtn.innerText = "Start Training";
    }
    async initModel() {
        if (this.isTraining)
            return;

        if (this.currentTraining)
            this.currentTraining.dispose();

        this.setHyperParamsActive(false);

        await tf.setBackend(this.currentBackend); // cpu, webgl, wasm
        await tf.ready();
        let {model, losses} = await this.buildModel();
        this.currentTraining = model;
        let optimizer = (this.shadowRoot.getElementById("optimizer") as SlSelect).value as string;
        let lr = parseFloat((this.shadowRoot.getElementById("lr") as SlInput).value);
        let momentum = parseFloat((this.shadowRoot.getElementById("momentum") as SlInput).value);
        model.compile({
            optimizer: optimizer != "momentum" ? tf.train[optimizer](lr) : tf.train["momentum"](lr, momentum),
            loss: losses,
            metrics: ["accuracy", tf.metrics.r2Score, tf.metrics.precision, tf.metrics.recall],
        });
        model.summary();
        console.log(model.toJSON());
    }
    async training() {
        let that = this;
        if (this.currentTraining != null && this.isTraining) {
            this.currentTraining.stopTraining = true;
            this.isTraining = false;
            console.log("stop training")
            return;
        }
        this.trainingMetricsDiv.style.display = "";

        if (this.currentTraining == null) {
            await this.initModel();
        }

        this.startTrainingBtn.innerText = "Stop Training";

        if (this.currentTraining != null && !this.isTraining) {
            this.isTraining = true;
            this.resetTrainingBtn.disabled = true;
            let dataset = (this.featureSelect.getRefElement() as AiWidgetsFeatures).getDataset().tensorDataset;
            let model = (this.modelSelect.getRefElement() as AiWidgetsDesigns).getModel();

            let inputNames: Set<string> = new Set();
            for (let input_node of model.filter(l => l.type == "input"))
                inputNames.add(input_node.select)

            let outputNames: Set<string> = new Set();
            for (let output_node of model.filter(l => l.type == "output"))
                outputNames.add(output_node.select);


            let batchsize = parseInt((this.shadowRoot.getElementById("batch") as SlInput).value)
            const tfDataset = tf.data.generator(dataset.getTrainingDataGenerator(inputNames, outputNames)).batch(batchsize).prefetch(4)
            const valDataset = tf.data.generator(dataset.getValidationDataGenerator(inputNames, outputNames)).batch(batchsize).prefetch(4)

            let lastEpoch = Date.now();
            let numEpochs = parseInt((this.shadowRoot.getElementById("epochs") as SlInput).value);

            await this.currentTraining.fitDataset(tfDataset, {
                epochs: this.currentEpoch + numEpochs + 1,
                validationData: valDataset,
                initialEpoch: this.currentEpoch + 1,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        if (this.currentTraining.stopTraining == true)
                            return;
                        for (let loss in logs) {
                            let label = loss.replace("loss","Loss").replace("acc","Accuracy").replace("r2Score2","R2_Score").replace("recall2","Recall").replace("percision2","Percision").replace("val_","Validation_");
                            if (label.indexOf("Validation") == -1)
                                label = "Training_" + label;

                            //label = loss;

                            if (this.losses[label] == null)
                                this.losses[label] = [];
                            this.losses[label].push(Math.round(logs[loss] * 1000) / 1000);
                            if (loss == "val_loss" && logs[loss] < this.insights.min_val_loss ) {
                                this.insights.min_val_loss = logs[loss];
                                this.insights.min_val_loss_index = epoch;
                                await this.currentTraining.save('indexeddb://best');
                            }
                        }

                        if (epoch % 5 == 0)
                            await this.currentTraining.save('indexeddb://epoch-' + epoch);

                        that.updateGraph();
                        this.chart.removeAnnotation("best");
                        this.chart.addPointAnnotation({
                            id: "best",
                            x: this.insights.min_val_loss_index,
                            y: this.insights.min_val_loss,
                            label: {
                                text: "Best",
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

                        this.dispatchEvent(new CustomEvent('epoch', {detail: {}}));
                    }
                }
            }).then(function() {
                that.resetTrainingBtn.disabled = false;
                that.currentTraining.stopTraining = false;
                that.startTrainingBtn.innerText = "Continue Training";
                that.isTraining = false;
            }).catch(async function(err) {
                console.error(err);
                that.resetTrainingBtn.disabled = false;
                that.currentTraining.stopTraining = false;
                that.startTrainingBtn.innerText = "Continue Training";
                that.isTraining = false;
                let index = that.backendPriority.indexOf(tf.getBackend()) + 1
                if (index == that.backendPriority.length)
                    console.error("no more backends left this probably means the model is broken");
                console.warn("switching to backend " + that.backendPriority[index]);
                that.currentBackend = that.backendPriority[index];
                await that.initModel();
                await that.training();
            });
            this.dispatchEvent(new CustomEvent('finished', {detail: {}}));
        }
    }
    async disconnectedCallback(): Promise<void> {
        tf.backend().dispose();
        tf.dispose();
    }
}

