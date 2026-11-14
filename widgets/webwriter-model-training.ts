import type { MsgFn } from "@lit/localize";
import { effectiveLanguage, localizeElement, nativeLanguageAttributes } from "../localization/localizer";
import { readData, writeData } from "../lib/data-block";
import { SlButton, SlButtonGroup, SlCheckbox, SlIcon, SlIconButton, SlInput, SlOption, SlSelect, SlTooltip } from "@shoelace-style/shoelace";
import { LitElementWw } from "@webwriter/lit";
import ApexCharts from "apexcharts";
import { css, html, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { AiWidgetsFeatures } from "./webwriter-feature-engineering";
import { AiWidgetsDesigns } from "./webwriter-model-designing";
//import {setWasmPaths, setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
import { Editor, Layer } from "../lib/layers";
//setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
//setThreadsCount(4);

import type * as TF from "@tensorflow/tfjs";
import getTF from "../lib/tflib";
let tf: typeof TF;

function uint8ToHex(uint8:Uint8Array) {
  return Array.from(uint8, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8(hex:string) {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const len = hex.length / 2;
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return result;
}

(async () => {
    tf = await getTF()

    /**
     * The NoOpLayer is important for designating an output name. This will be read by later widgets to connect the correct model output to the dataset labels.
     */
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
    (window as any).NoOpLayer = NoOpLayer;

    tf.serialization.registerClass(NoOpLayer);
})()

/**
 * A widget to train models designed in the model designing widget using datasets created in the feature engineering widget.
 * 
 * @event finished - Fired when the training process has finished.
 * @event epoch - Fired after each epoch during training.
 */
@customElement("webwriter-model-training")
export class AiWidgetsTraining extends LitElementWw {
    static override get observedAttributes() { return nativeLanguageAttributes(this, super.observedAttributes); }

    override get lang(): string { return effectiveLanguage(this); }
    override set lang(value: string) { this.setAttribute("lang", value); }
    public readonly msg = localizeElement(this, true);
    readonly options = ((msg: MsgFn) => ({
        featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: { get _() { return msg("Feature source"); } }},
        modelWidgetId: {type: "reference" as const, selector: "webwriter-model-designing", label: { get _() { return msg("Design source"); } }},
        editMode: {type: "select" as const, label: { get _() { return msg("Edit permissions"); } }, options: [{value: "edit", label: { get _() { return msg("Edit everything"); } }}, {value: "hidden", label: { get _() { return msg("Hide widget"); } }}]},
        currentBackend: {type: "select" as const, label: { get _() { return msg("Preferred backend"); } }, options: [{value: "cpu", label: { get _() { return msg("CPU"); } }}, {value: "webgl", label: { get _() { return msg("WebGL (GPU)"); } }}]},
        cache: {type: Boolean, label: { get _() { return msg("Cache training samples"); } }},
    }))(this.msg);

    /** @internal */
    static scopedElements = {
        "sl-button": SlButton,
        "sl-button-group": SlButtonGroup,
        "sl-option": SlOption,
        "sl-select": SlSelect,
        "sl-input":SlInput,
        "sl-icon": SlIcon,
        "sl-icon-button": SlIconButton,
        "sl-checkbox": SlCheckbox,
        "sl-tooltip": SlTooltip,
        "ref-select": AiWidgetsReferenceSelect
    }

    static styles = css`
    :host {
      display:block;
      font-size: 0.9rem;
    }
    :host([contenteditable][editmode="hidden"]) {
      min-height: 30px;
      background:lightgray;
      font-size: inherit;
    }
    :host div[part='options'] {
      display:none;
    }
    :host([contenteditable]) div[part='options'] {
      display:block;
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
    `

    /**
     * The feature engineering widget to use as data source for training the model.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    @query('#feature-select')
    private accessor featureSelect;

    /**
     * The model design widget to use as model source for training.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;

    @query('#design-select')
    private accessor modelSelect;

    @query('#start-training')
    private accessor startTrainingBtn;

    @query('#reset-training')
    private accessor resetTrainingBtn;

    @query('#training-metrics')
    private accessor trainingMetricsDiv;

    @query("#speed")
    private accessor speed:HTMLSpanElement;

    @query("#memory")
    private accessor memory:HTMLSpanElement;

    @query("#error")
    private accessor error:HTMLSpanElement;

    /**
     * If true, the transformed training samples will be cached for faster training.
     */
    @property({ type: Boolean, attribute: true, reflect: true })
    accessor cache: boolean;

    /** The prefered tfjs backend */
     @property({ type: String, attribute: true, reflect: true })
    accessor currentBackend: "webgl" | "cpu" = "webgl";

    /** Stores the model jsons with a name like "best" or "epoch-20" for loading by the inference and test widgets */
    get modelVersions(): Record<string, string> {
        const {modelVersions} = readData<{modelVersions: Record<string, string>}>(this);
        return modelVersions ?? {};
    }

    set modelVersions(modelVersions: Record<string, string>) {
        writeData(this, {modelVersions});
    }

    private notifyModelVersions() {
        this.dispatchEvent(new CustomEvent("finished"));
    }

    private dataObserver = new MutationObserver(() => this.notifyModelVersions());

    connectedCallback() {
        super.connectedCallback();
        this.dataObserver.observe(this, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["type", "slot", "src"]});
        this.notifyModelVersions();
    }


    /** "edit" means that students can use the widget to train a model while "hidden" means the widget will be invisible to student but the trained models can be used by other widgets. */
    @property({ type: String, attribute: true, reflect: true, useDefault: true })
    accessor editMode: "edit"|"hidden" = "edit";

    @query("#optimizer")
    private accessor optimizer: SlSelect;

    @query("#lr")
    private accessor lr: SlInput;

    @query("#momentum")
    private accessor momentum: SlInput;

    @query("#batch")
    private accessor batch: SlInput;

    @query("#epochs")
    private accessor epochs: SlInput;

    constructor() {
        super();
        let that = this;
        setInterval(function() {
            try {
                that.memory.innerText = (tf.memory().numBytes / 1024 / 1024).toFixed(2);
            } catch(e) {}
        }, 50) 
    }

    public render(): TemplateResult {
        let that = this;
        setTimeout(function () { that.chart.render() }, 100);

        return html`
        <div id="content" style=${this.editMode == "hidden" ? "display:none" : ""}>
            <div class="controls">
                <sl-select id="optimizer" value="adam" label=${this.msg("Optimizer")} size="small" @sl-change=${this.changeOptimizer}>
                    <sl-option value="adam">Adam</sl-option>
                    <sl-option value="momentum">Momentum</sl-option>
                    <sl-option value="rmsprop">RMSProp</sl-option>
                    <sl-option value="sgd">SGD</sl-option>
                </sl-select>
                <sl-input id="lr" type="number" label=${this.msg("Learning Rate")} min="0.0001" max="0.01" value="0.002" step="0.0005" size="small" style="max-width:100px"></sl-input>
                <sl-input style="display:none" id="momentum" type="number" label=${this.msg("Momentum")} min="0.1" max="0.99" value="0.9" size="small" style="max-width:100px"></sl-input>
                <sl-input id="batch" type="number" label=${this.msg("Batch Size")} min="1" max="512" value="128" step="1" size="small" style="max-width:100px"></sl-input>
                <sl-input id="epochs" type="number" label=${this.msg("Epochs")} min="1" max="500" value="20" size="small" style="max-width:100px"></sl-input>
                <sl-button-group>
                <sl-button id="start-training" @click=${this.training}>${this.msg("Start training")}</sl-button>
                <sl-button id="reset-training" @click=${this.resetModel}>${this.msg("Reset")}</sl-button>
                </sl-button-group>
            </div>
            <p id="error" style="display:none"></p>
            <div id="training-metrics" style="display:none">
                ${this.chartContainer}
                <sl-select id="metrics" value="Loss Accuracy" multiple clearable @sl-change=${this.updateGraph}>
                    <sl-option value="Loss">${this.msg("Loss")}</sl-option>
                    <sl-option value="Accuracy">${this.msg("Accuracy")}</sl-option>
                    <sl-option value="R2_Score">${this.msg("R2 Score")}</sl-option>
                    <sl-option value="Percision">${this.msg("Precision")}</sl-option>
                    <sl-option value="Recall">${this.msg("Recall")}</sl-option>
                </sl-select>
                <p style="margin:0px">${this.msg("Training Speed:")} <span id="speed">0</span>s/epoch&nbsp;&nbsp;&nbsp;&nbsp;${this.msg("Used Tensor Memory:")} <span id="memory"></span>MB</p>
            </div>
        </div>
        <p style=${this.editMode != "hidden" ? "display:none" : ""}>${this.msg("Model Training Widget hidden from students.")}</p>
            <div hidden>
            <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-feature-engineering" @refchange=${(e) => this.featureWidgetId = e.detail.id} ownerId=${this.id}></ref-select>
            <ref-select id="design-select" typeName="Design" elemId=${this.modelWidgetId} elementType="webwriter-model-designing" @refchange=${(e) => this.modelWidgetId = e.detail.id} ownerId=${this.id}></ref-select>
        </div>`
    }

    private showError(err:string) {
        this.error.innerHTML = err;
        this.error.style.display = "block";
    }
    private hideError() {
        this.error.style.display = "none";
    }

    private changeOptimizer() {
        let optimizer = (this.shadowRoot.getElementById("optimizer") as SlSelect).value as string;
        if (optimizer == "momentum") {
            this.shadowRoot.getElementById("momentum").style.display = "";
        } else {
            this.shadowRoot.getElementById("momentum").style.display = "none";
        }
    }

    private setHyperParamsActive(active:boolean) {
        this.optimizer.disabled = !active;
        this.lr.disabled = !active;
        this.momentum.disabled = !active;
        this.batch.disabled = !active;
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

    /**
     * Used to recursively connect the inputs via the layers to the output nodes.
     * @param layer One output layer of the model to solve the dependencies for.
     * @param inputs All the input tensors of the model with the "in_<feature>"" as the key.
     * @param resolvedLayers A reference to an array storing the already resolved layers for later use when solving for other output layers.
     * @returns Returns a NoOpLayer with an output name of "out_<feature>"
     */
    resolveOutput(layer: Layer, inputs: Record<string, TF.SymbolicTensor>, resolvedLayers: Record<number, any>): TF.SymbolicTensor {
        let visitedLayersInThisPath = [];

        function resolveLayer(layer: Layer, input_layers: Record<string, TF.SymbolicTensor>): Record<string, TF.SymbolicTensor> {
            if (visitedLayersInThisPath.indexOf(layer.id) != -1)
                throw Error("cyclic dependency in network")
            if (resolvedLayers[layer.id] != null)
                return resolvedLayers[layer.id];

            let outputTensor = layer.forward(input_layers)
            resolvedLayers[layer.id] = outputTensor;
            visitedLayersInThisPath.push(layer.id);
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

        return new (window as any).NoOpLayer({name: "out_" + layer.getState().select}).apply(resolveDependencies(Object.values(layer.getInputLayers())[0].outputOfLayer).output_1) as TF.SymbolicTensor;
    }

    /**
     * Builds the complete tfjs model using the layers from the model design widget. It sets the correct input names for the input layers as "in_<feature>". The output layers dependency graph is build and the loss is applied to the output tensor for training.
     * @returns Model and losses for training
     */
    async buildModel() {
        this.hideError();
        let design = this.modelSelect.getRefElement() as AiWidgetsDesigns;

        let featureWidget = this.featureSelect.getRefElement() as AiWidgetsFeatures;
        let dataset = featureWidget?.getDataset()?.tensorDataset;
        if (dataset == null) {
            this.showError("The feature data is not ready yet. Please wait a moment and try again.")
            return null;
        }

        let model = null;
        try { model = design.getModel(); } catch (e) { console.warn("Live model export failed, using saved state.", e); }
        let missingSelection = !model || model.length == 0 || model.some(l => (l.type == "input" || l.type == "output") && (l.select == null || l.select == ""));
        if (missingSelection && design.state)
            model = JSON.parse(design.state);

        if (model == null || model.length == 0) {
            this.showError("No model design available.")
            return null;
        }

        let editor = new Editor(document.createElement("div"), "read", design.maxModelParameters, design.maxLayerParameters, this.msg);
        await editor.import(model, dataset)

        if (editor.getNumberOfParameters() > design.maxModelParameters) {
            this.showError("The Neural Network is to large. Reduce the overall number of parameters.")
            return null;
        }

        for (let layer of model) {
            if (!layer.valid) {
                this.showError("A layer has an Invalid configuration.")
                return null;
            }
        }

        let inputs: Record<string, TF.SymbolicTensor> = {};
        for (let input_node of model.filter(l => l.type == "input")) {
            let shape = dataset.featureMaps[input_node.select].size();
            inputs[input_node.select] = tf.input({ shape: shape , name:"in_" + input_node.select});
        }

        let outputs: Record<string, TF.SymbolicTensor> = {};
        let resolvedLayers = {};
        let losses = {};
        for (let output of editor.getOutputs()) {
            outputs[output.getState().select] = this.resolveOutput(output, inputs, resolvedLayers);
            losses["out_" + output.getState().select] = this.lossStringToFunction(output.getState().loss);
        }

        return {model:tf.model({ inputs: Object.values(inputs), outputs: Object.values(outputs) }), losses}
    }

    /**
     * Converts a loss string to the corresponding tfjs loss function.
     * @param loss The loss string like "MSE" or "BCE"
     * @returns The tfjs loss function
     */
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

    private updateGraph() {
        let metrics = (this.shadowRoot.getElementById("metrics") as SlSelect).value as string[]
        this.chart.updateSeries(
            Object.entries(this.losses).map(
                function ([k, v]) { return { name: k, data: v } }
            ).filter(e => metrics.indexOf(e.name.replace("Training_","").replace("Validation_", "")) != -1)
        )
    }

    /**
     * Returns the model for named checkpoints for other widgets to use.
     * @param name The checkpoint name like "best" or "epoch-20". All the available checkpoints can be retrieved via this.getAvailableModels().
     * @returns The tf.LayersModel in an initialized state ready for use.
     */
    public async getModel(name) {
        if (this.modelVersions == null || this.modelVersions[name] == null)
            return null;
        const jsonObj = JSON.parse(this.modelVersions[name]);
        const modelWeights = hexToUint8(jsonObj.weightData);
        const handler = {
            load: async () => {
                const modelArtifacts = {
                    modelTopology: jsonObj.modelTopology,
                    weightSpecs: jsonObj.weightSpecs,
                    weightData: modelWeights.buffer,
                };

                return modelArtifacts;
            }
        };

        const model = await tf.loadLayersModel(handler);
        return model;
    }

    /** Returns the available model checkpoints */
    public getAvailableModels() {
        return Object.keys(this.modelVersions);
    }

    /** Deletes all model checkpoints */
    private clearModels() {
        this.modelVersions = {};
        this.dispatchEvent(new CustomEvent('finished', {detail: {}}));
    }

    /** Is true, while tf is in the training process */
    private isTraining = false;

    /** contains the currently trained model */
    private currentTraining: TF.LayersModel;
    private currentEpoch = 0;

    /** A list of available backends for tf to use. Could be expanded and are tried out in order. (Not all backends support all layer and operation types, but can provide better training speed) */
    private backendPriority = ["webgl","cpu"];

    /**
     * Sets the state of this training widget back to the initial configuration and deletes previous training progress.
     */
    private resetModel() {
        this.hideError();
        this.trainingMetricsDiv.style.display = "none";
        if (this.currentTraining)
            this.currentTraining.dispose();
        this.currentTraining = null;
        this.clearModels();
        this.losses = {}
        this.currentEpoch = 0;
        this.insights = {min_val_loss: 100, min_val_loss_index: 0}; 
        if (this.chart != null)
            this.chart.removeAnnotation("best");
        this.updateGraph();
        this.setHyperParamsActive(true);
        this.startTrainingBtn.innerText = this.msg("Start Training");
    }

    /**
     * Initializes the model for training and preps the UI.
     */
    async initModel() {
        if (this.isTraining)
            return;

        this.hideError();
        if (this.currentTraining)
            this.currentTraining.dispose();

        try {
            await tf.setBackend(this.currentBackend); // cpu, webgl, wasm
            await tf.ready();
            let built = await this.buildModel();
            if (built == null || built.model == null || built.losses == null)
                return;
            let {model, losses} = built;
            this.setHyperParamsActive(false);
            this.currentTraining = model;
            let optimizer = (this.shadowRoot.getElementById("optimizer") as SlSelect).value as string;
            let lr = parseFloat(this.lr.value);
            let momentum = parseFloat(this.momentum.value);
            model.compile({
                optimizer: optimizer != "momentum" ? tf.train[optimizer](lr) : tf.train["momentum"](lr, momentum),
                loss: losses,
                metrics: ["accuracy", tf.metrics.r2Score, tf.metrics.precision, tf.metrics.recall],
            });
            model.summary();
        } catch (e) {
            console.error(e);
            this.showError("Could not build the model. Please check the model design and feature data.")
        }
    }

    /**
     * Runs the tf training loop and keeps the UI up-to-date
     */
    async training() {
        let that = this;
        if (this.currentTraining != null && this.isTraining) {
            this.currentTraining.stopTraining = true;
            this.isTraining = false;
            console.log("stop training")
            return;
        }

        if (this.currentTraining == null) {
            await this.initModel();
        }

        if (this.currentTraining == null)
            return;

        this.trainingMetricsDiv.style.display = "";
        this.startTrainingBtn.innerText = this.msg("Stop Training");

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

            let batchsize = parseInt(this.batch.value)
            const tfDataset = tf.data.generator(dataset.getTrainingDataGenerator(inputNames, outputNames, this.cache)).batch(batchsize).prefetch(4)
            const valDataset = tf.data.generator(dataset.getValidationDataGenerator(inputNames, outputNames, this.cache)).batch(batchsize).prefetch(4)

            let lastEpoch = Date.now();
            let numEpochs = parseInt(this.epochs.value);

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
                                await this.saveCurrentModel('best');
                            }
                        }

                        //if (epoch % 5 == 0)
                            //await this.saveCurrentModel('epoch-' + epoch);

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
            }).then(async function() {
                that.resetTrainingBtn.disabled = false;
                that.currentTraining.stopTraining = false;
                that.startTrainingBtn.innerText = that.msg("Continue Training");
                that.isTraining = false;
                await that.saveCurrentModel('epoch-' + that.currentEpoch);
            }).catch(async function(err) {
                console.error(err);
                that.resetTrainingBtn.disabled = false;
                that.currentTraining.stopTraining = false;
                that.startTrainingBtn.innerText = that.msg("Continue Training");
                that.isTraining = false;
                let index = that.backendPriority.indexOf(tf.getBackend()) + 1
                if (index == that.backendPriority.length)
                    console.error("The model is broken.");
                console.warn("switching to backend " + that.backendPriority[index]);
                that.currentBackend = that.backendPriority[index] as ("cpu" | "webgl");
                await that.initModel();
                await that.training();
            });
            this.dispatchEvent(new CustomEvent('finished', {detail: {}}));
        }
    }

    /** This is called when the widget is removed from the UI (i.e. deleted by the user or reload) */
    async disconnectedCallback(): Promise<void> {
        this.dataObserver.disconnect();
        super.disconnectedCallback();
        tf.backend().dispose();
        tf.dispose();
    }

    /**
     * Saves the current model as a checkpoint for other widgets to use later.
     * @param name The checkpoint name.
     */
    async saveCurrentModel(name) {
        let that = this;

        async function handleSave(artifats) {
            const weightData = new Uint8Array(artifats.weightData);
            const b64encoded = uint8ToHex(weightData);

            const checkpoint = JSON.stringify({
                modelTopology: artifats.modelTopology,
                weightSpecs: artifats.weightSpecs,
                weightData: b64encoded
            });
            
            that.modelVersions = {...that.modelVersions, [name]: checkpoint};
            return {} as TF.io.SaveResult;
        }
        await this.currentTraining.save(tf.io.withSaveHandler(handleSave));
    }
}

