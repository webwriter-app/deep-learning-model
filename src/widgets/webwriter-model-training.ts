import type { MsgFn } from "@lit/localize";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlCheckbox from "@shoelace-style/shoelace/dist/components/checkbox/checkbox.component.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import { computed, LitElementWw, signal } from "@webwriter/lit";
import { jsonData } from "@webwriter/lit/data";
import { localizer } from "@webwriter/lit/localize";
import { html, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { localeOptions } from "../../localization/locale-options";
import styles from "../components/model-training.styles";
import { TrainingChart } from "../components/training-chart";
import { AiWidgetsReferenceSelect } from "../components/reference-element-select";
import { WebwriterFeatureEngineering } from "./webwriter-feature-engineering";
import { WebwriterModelDesigning } from "./webwriter-model-designing";

import type * as TF from "@tensorflow/tfjs";
import getTF from "../model/tflib";
import { analyze, featureSizes, importLayers, type LayerState } from "../model/network";
import { connectNetwork } from "../model/network-build";
import { historyTable, hexToUint8, lastValue, pickCheckpoint, uint8ToHex } from "../model/training";
import { tableElement } from "../components/table-element";
import { tableToCsv, type Table } from "../model/dataset/table";

type Labelled = { msg: MsgFn };

const tf = await getTF();
/**
 * A widget to train models designed in the model designing widget using datasets created in the feature engineering widget.
 * 
 * Signals: `history` is the table of the metrics per epoch (columns "epoch", "Training Loss", "Validation Loss" and the
 * other selected metrics), empty until the first epoch ends and after a reset. `loss` is the latest validation loss
 * as a number, or null. Another widget connects to them with an effect attribute such as `data-from="#training[history]"`.
 *
 * Conversions: the history leaves as a `table` or as `text/csv`; the best checkpoint (else the latest) leaves as
 * `application/json` with the TensorFlow.js model topology, weight specs and the weights as hex text.
 * The history is not stored in the document, so the exports hold what was trained since the widget loaded.
 *
 * @event finished - Fired when the training process has finished.
 * @event epoch - Fired after each epoch during training.
 *
 * @part chart - The chart of the training metrics.
 */
@customElement("webwriter-model-training")
export class WebwriterModelTraining extends LitElementWw {
    static styles = styles

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

    static options = {
        featureWidgetId: {type: "reference" as const, selector: "webwriter-feature-engineering", label: (widget: Labelled) => widget.msg("Feature source")},
        modelWidgetId: {type: "reference" as const, selector: "webwriter-model-designing", label: (widget: Labelled) => widget.msg("Design source")},
        editMode: {
            type: "select" as const,
            label: (widget: Labelled) => widget.msg("Edit permissions"),
            options: [
                {value: "edit", label: (widget: Labelled) => widget.msg("Edit everything")},
                {value: "hidden", label: (widget: Labelled) => widget.msg("Hide widget")},
            ],
        },
        currentBackend: {
            type: "select" as const,
            label: (widget: Labelled) => widget.msg("Preferred backend"),
            options: [
                {value: "cpu", label: (widget: Labelled) => widget.msg("CPU")},
                {value: "webgl", label: (widget: Labelled) => widget.msg("WebGL (GPU)")},
            ],
        },
        cache: {type: Boolean, label: (widget: Labelled) => widget.msg("Cache training samples")},
    }

    static convertTo = {
        table: "toTable",
        "text/csv": "exportHistory",
        "application/json": "exportModel",
    }

    readonly localize = localizer(this, localeOptions);
    public readonly msg = this.localize.msg;

    /** Stores the model jsons with a name like "best" or "epoch-20" for loading by the inference and test widgets */
    #data = jsonData<{modelVersions: Record<string, string>}>(this, {defaults: {modelVersions: {}}, changed: () => this.notifyModelVersions()});

    /**
     * The feature engineering widget to use as data source for training the model.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor featureWidgetId: string;

    /**
     * The model design widget to use as model source for training.
     */
    @property({ type: String, attribute: true, reflect: true })
    accessor modelWidgetId: string;

    /**
     * If true, the transformed training samples will be cached for faster training.
     */
    @property({ type: Boolean, attribute: true, reflect: true })
    accessor cache: boolean;

    /** The prefered tfjs backend */
    @property({ type: String, attribute: true, reflect: true })
    accessor currentBackend: "webgl" | "cpu" = "webgl";

    /** "edit" means that students can use the widget to train a model while "hidden" means the widget will be invisible to student but the trained models can be used by other widgets. */
    @property({ type: String, attribute: true, reflect: true, useDefault: true })
    accessor editMode: "edit"|"hidden" = "edit";

    @query('#feature-select')
    private accessor featureSelect: AiWidgetsReferenceSelect;

    @query('#design-select')
    private accessor modelSelect: AiWidgetsReferenceSelect;

    @query('#start-training')
    private accessor startTrainingBtn: SlButton;

    @query('#reset-training')
    private accessor resetTrainingBtn: SlButton;

    @query('#training-metrics')
    private accessor trainingMetricsDiv: HTMLDivElement;

    @query("#speed")
    private accessor speed:HTMLSpanElement;

    @query("#memory")
    private accessor memory:HTMLSpanElement;

    @query("#error")
    private accessor error:HTMLSpanElement;

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

    /** Is true, while tf is in the training process */
    private isTraining = false;

    /** contains the currently trained model */
    private currentTraining: TF.LayersModel | null = null;
    private currentEpoch = 0;

    /** A list of available backends for tf to use. Could be expanded and are tried out in order. (Not all backends support all layer and operation types, but can provide better training speed) */
    private backendPriority = ["webgl","cpu"];

    #history = signal<Table>({columns: ["epoch"], rows: []});

    /** Published for other widgets: the metrics per epoch and the latest validation loss. */
    readonly signals = {
        history: computed(() => this.#history.get()),
        loss: computed(() => lastValue(this.#history.get(), "Validation Loss")),
    };

    private memoryTimer?: ReturnType<typeof setInterval>;

    private losses: Record<string, Array<number>> = {};
    private insights = {min_val_loss: 100, min_val_loss_index: 0};
    private chart?: TrainingChart;


    connectedCallback() {
        super.connectedCallback();
        this.notifyModelVersions();
        this.memoryTimer = setInterval(() => {
            try {
                this.memory.innerText = (tf.memory().numBytes / 1024 / 1024).toFixed(2);
            } catch(e) {}
        }, 50);
    }

    protected firstUpdated() {
        this.chart = new TrainingChart(this.shadowRoot!.getElementById("chart") as HTMLCanvasElement);
    }

    /** This is called when the widget is removed from the UI (i.e. deleted by the user or reload) */
    async disconnectedCallback(): Promise<void> {
        super.disconnectedCallback();
        this.chart?.destroy();
        this.chart = undefined;
        clearInterval(this.memoryTimer);
        this.memoryTimer = undefined;
        tf.backend().dispose();
        tf.dispose();
    }

    get modelVersions(): Record<string, string> {
        return this.#data.get().modelVersions;
    }

    set modelVersions(modelVersions: Record<string, string>) {
        this.#data.set({modelVersions});
        this.notifyModelVersions();
    }

    private publishHistory() {
        this.#history.set(historyTable(this.losses));
    }

    /** The history as a table, or null before the first epoch. */
    toTable() {
        const {columns, rows} = this.#history.get();
        if (rows.length === 0) return null;
        return tableElement({columns, rows});
    }

    /** The history as CSV, or null before the first epoch. */
    exportHistory() {
        const table = this.#history.get();
        return table.rows.length === 0 ? null : new File([tableToCsv(table)], "training-history.csv", {type: "text/csv"});
    }

    /** The best checkpoint as JSON, or null without a checkpoint. */
    exportModel() {
        const name = pickCheckpoint(this.getAvailableModels());
        return name == null ? null : new File([this.modelVersions[name]], `model-${name}.json`, {type: "application/json"});
    }

    private notifyModelVersions() {
        this.dispatchEvent(new CustomEvent("finished"));
    }

    private setHyperParamsActive(active:boolean) {
        this.optimizer.disabled = !active;
        this.lr.disabled = !active;
        this.momentum.disabled = !active;
        this.batch.disabled = !active;
    }

    private showError(err:string) {
        this.error.innerHTML = err;
        this.error.style.display = "block";
    }
    private hideError() {
        this.error.style.display = "none";
    }

    /**
     * Builds the complete tfjs model using the layers from the model design widget. It sets the correct input names for the input layers as "in_<feature>". The output layers dependency graph is build and the loss is applied to the output tensor for training.
     * @returns Model and losses for training
     */
    async buildModel() {
        this.hideError();
        let design = this.modelSelect.getRefElement() as WebwriterModelDesigning;

        let featureWidget = this.featureSelect.getRefElement() as WebwriterFeatureEngineering;
        let dataset = featureWidget?.getDataset()?.tensorDataset;
        if (dataset == null) {
            this.showError("The feature data is not ready yet. Please wait a moment and try again.")
            return null;
        }

        let model: LayerState[] | null = null;
        try { model = design.getModel(); } catch (e) { console.warn("Live model export failed, using saved state.", e); }
        let missingSelection = !model || model.length == 0 || model.some(l => (l.type == "input" || l.type == "output") && (l.select == null || l.select == ""));
        if (missingSelection && design.state)
            model = importLayers(JSON.parse(design.state));

        if (model == null || model.length == 0) {
            this.showError("No model design available.")
            return null;
        }

        let analysis = analyze(model, featureSizes(dataset), {layer: design.maxLayerParameters, model: design.maxModelParameters});
        if (analysis.parameters > design.maxModelParameters) {
            this.showError("The Neural Network is to large. Reduce the overall number of parameters.")
            return null;
        }

        for (let info of analysis.layers.values()) {
            if (!info.valid) {
                this.showError("A layer has an Invalid configuration.")
                return null;
            }
        }

        let inputs: Record<string, TF.SymbolicTensor> = {};
        for (let input_node of model.filter(l => l.type == "input")) {
            let shape = dataset.featureMaps[input_node.select as string].size();
            inputs[input_node.select as string] = tf.input({ shape: shape , name:"in_" + input_node.select});
        }

        let {outputs, losses} = connectNetwork(model, inputs);

        return {model:tf.model({ inputs: Object.values(inputs), outputs: Object.values(outputs) }), losses}
    }

    /**
     * Returns the model for named checkpoints for other widgets to use.
     * @param name The checkpoint name like "best" or "epoch-20". All the available checkpoints can be retrieved via this.getAvailableModels().
     * @returns The tf.LayersModel in an initialized state ready for use.
     */
    public async getModel(name: string): Promise<TF.LayersModel | null> {
        if (this.modelVersions == null || this.modelVersions[name] == null)
            return null;
        const jsonObj = JSON.parse(this.modelVersions[name]);
        const modelWeights = hexToUint8(jsonObj.weightData);
        return tf.loadLayersModel({
            load: async () => ({
                modelTopology: jsonObj.modelTopology,
                weightSpecs: jsonObj.weightSpecs,
                weightData: modelWeights.buffer,
            })
        });
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
        this.publishHistory();
        this.currentEpoch = 0;
        this.insights = {min_val_loss: 100, min_val_loss_index: 0};
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
            let optimizer = this.optimizer.value as "adam" | "momentum" | "rmsprop" | "sgd";
            let lr = parseFloat(this.lr.value);
            let momentum = parseFloat(this.momentum.value);
            model.compile({
                optimizer: optimizer != "momentum" ? tf.train[optimizer](lr) : tf.train.momentum(lr, momentum),
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
            return;
        }

        if (this.currentTraining == null) {
            await this.initModel();
        }

        const training = this.currentTraining;
        if (training == null)
            return;

        this.trainingMetricsDiv.style.display = "";
        this.startTrainingBtn.innerText = this.msg("Stop Training");

        if (!this.isTraining) {
            this.isTraining = true;
            this.resetTrainingBtn.disabled = true;
            let dataset = (this.featureSelect.getRefElement() as WebwriterFeatureEngineering).getDataset().tensorDataset!;
            let model = (this.modelSelect.getRefElement() as WebwriterModelDesigning).getModel();

            let inputNames: Set<string> = new Set();
            for (let input_node of model.filter(l => l.type == "input"))
                inputNames.add(input_node.select as string)

            let outputNames: Set<string> = new Set();
            for (let output_node of model.filter(l => l.type == "output"))
                outputNames.add(output_node.select as string);

            let batchsize = parseInt(this.batch.value)
            const tfDataset = tf.data.generator(dataset.getTrainingDataGenerator(inputNames, outputNames, this.cache)).batch(batchsize).prefetch(4)
            const valDataset = tf.data.generator(dataset.getValidationDataGenerator(inputNames, outputNames, this.cache)).batch(batchsize).prefetch(4)

            let lastEpoch = Date.now();
            let numEpochs = parseInt(this.epochs.value);

            await training.fitDataset(tfDataset, {
                epochs: this.currentEpoch + numEpochs + 1,
                validationData: valDataset,
                initialEpoch: this.currentEpoch + 1,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        if (training.stopTraining == true)
                            return;
                        for (let loss in logs) {
                            let label = loss.replace("loss","Loss").replace("acc","Accuracy").replace("r2Score2","R2_Score").replace("recall2","Recall").replace("percision2","Percision").replace("val_","Validation_");
                            if (label.indexOf("Validation") == -1)
                                label = "Training_" + label;

                            if (this.losses[label] == null)
                                this.losses[label] = [];
                            this.losses[label].push(Math.round(logs[loss] * 1000) / 1000);
                            if (loss == "val_loss" && logs[loss] < this.insights.min_val_loss ) {
                                this.insights.min_val_loss = logs[loss];
                                this.insights.min_val_loss_index = epoch;
                                await this.saveCurrentModel('best');
                            }
                        }

                        this.publishHistory();
                        this.updateGraph();
                        this.currentEpoch = epoch;

                        this.speed.innerText = (((Date.now() - lastEpoch) / 1000) * 0.7 + parseFloat(this.speed.innerText) * 0.3).toFixed(2);
                        lastEpoch = Date.now();

                        this.dispatchEvent(new CustomEvent('epoch', {detail: {}}));
                    }
                }
            }).then(async function() {
                that.resetTrainingBtn.disabled = false;
                training.stopTraining = false;
                that.startTrainingBtn.innerText = that.msg("Continue Training");
                that.isTraining = false;
                await that.saveCurrentModel('epoch-' + that.currentEpoch);
            }).catch(async function(err) {
                console.error(err);
                that.resetTrainingBtn.disabled = false;
                training.stopTraining = false;
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

    /**
     * Saves the current model as a checkpoint for other widgets to use later.
     * @param name The checkpoint name.
     */
    async saveCurrentModel(name: string) {
        let that = this;

        async function handleSave(artifats: TF.io.ModelArtifacts) {
            const weightData = new Uint8Array(artifats.weightData as ArrayBuffer);
            const b64encoded = uint8ToHex(weightData);

            const checkpoint = JSON.stringify({
                modelTopology: artifats.modelTopology,
                weightSpecs: artifats.weightSpecs,
                weightData: b64encoded
            });
            
            that.modelVersions = {...that.modelVersions, [name]: checkpoint};
            return {} as TF.io.SaveResult;
        }
        await this.currentTraining?.save(tf.io.withSaveHandler(handleSave));
    }

    private changeOptimizer() {
        this.momentum.style.display = this.optimizer.value == "momentum" ? "" : "none";
    }

    private updateGraph() {
        if (this.chart == null) return;
        let metrics = (this.shadowRoot!.getElementById("metrics") as SlSelect).value as string[]
        let series = Object.entries(this.losses).filter(([k]) => metrics.indexOf(k.replace("Training_","").replace("Validation_", "")) != -1);
        let best = this.insights.min_val_loss < 100 ? { index: this.insights.min_val_loss_index, value: this.insights.min_val_loss } : undefined;
        this.chart.update(series, best);
    }

    public render(): TemplateResult {
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
            <p id="error" role="alert" style="display:none"></p>
            <div id="training-metrics" style="display:none">
                <div id="chart-box" part="chart"><canvas id="chart" role="img" aria-label=${this.msg("Training Metrics")}></canvas></div>
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
            <ref-select id="feature-select" typeName="Features" elemId=${this.featureWidgetId} elementType="webwriter-feature-engineering" @refchange=${(e: CustomEvent) => this.featureWidgetId = e.detail.id} ownerId=${this.id}></ref-select>
            <ref-select id="design-select" typeName="Design" elemId=${this.modelWidgetId} elementType="webwriter-model-designing" @refchange=${(e: CustomEvent) => this.modelWidgetId = e.detail.id} ownerId=${this.id}></ref-select>
        </div>`
    }
}
