/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-feature-engineering";
import "../src/widgets/webwriter-model-training";
import "../src/widgets/webwriter-model-designing";
import { block, blocks, dataOf, modes, mounting, until } from "./helpers";
import { csv, csvSamples, design, json } from "./fixtures";

mocha.setup(getMochaConfig());

const tags = ["webwriter-feature-engineering", "webwriter-model-training", "webwriter-model-designing"];
const file = (text: string, name: string, type = "") => new File([text], name, { type });
const rejects = async (work: Promise<unknown>) => {
  try { await work; } catch (error) { return (error as Error).message; }
  throw new Error("expected the import to fail");
};
const ignored = { name: { type: "Ignore", settings: null }, size: { type: "Ignore", settings: null }, note: { type: "Ignore", settings: null } };
const fragment = (html: string) => document.createRange().createContextualFragment(html);

for (const mode of modes) {
  describe(`conversions (${mode} mode)`, function () {
    this.timeout(40000);
    const m = mounting(mode);
    before(async function () {
      m.start();
      await Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
    });
    after(() => m.stop());

    describe("feature engineering", function () {
      it("imports a CSV file, writes it to the data block and resets the feature settings", async function () {
        const features = m.mark(`<webwriter-feature-engineering></webwriter-feature-engineering>`);
        const apply = await features.importCsv(file(csv, "data.csv", "text/csv"));
        assert.isNull(features.samples, "nothing changes before the apply function runs");
        apply();
        assert.deepEqual(features.samples, csvSamples);
        assert.deepEqual(features.fieldProps, { name: { type: "Ignore", settings: null }, size: { type: "Ignore", settings: null }, note: { type: "Ignore", settings: null } });
        await until(() => blocks(features)[0] && dataOf(features).samples?.length === 2, "block write");
      });
      it("imports JSON and writes numbers and null as text", async function () {
        const features = m.mark(`<webwriter-feature-engineering></webwriter-feature-engineering>`);
        (await features.importJson(file(json, "data.json", "application/json")))();
        assert.deepEqual(features.samples, csvSamples);
      });
      it("refuses invalid files and keeps the dataset", async function () {
        const features = m.mark(`<webwriter-feature-engineering>${block({ samples: csvSamples, fieldProps: ignored })}</webwriter-feature-engineering>`);
        await until(() => features.samples?.length === 2, "samples");
        assert.match(await rejects(features.importCsv(file("a,a\n1,2\n", "x.csv"))), /not unique/);
        assert.match(await rejects(features.importCsv(file("a,b\n", "x.csv"))), /no rows/);
        assert.match(await rejects(features.importCsv(file("a\n1,2\n", "x.csv"))), /more values/);
        assert.match(await rejects(features.importJson(file("{", "x.json"))), /not valid JSON/);
        assert.match(await rejects(features.importJson(file('{"a":1}', "x.json"))), /array of objects/);
        assert.deepEqual(features.samples, csvSamples);
      });
      it("exports CSV and imports it again with the same samples", async function () {
        const features = m.mark(`<webwriter-feature-engineering>${block({ samples: csvSamples, fieldProps: ignored })}</webwriter-feature-engineering>`);
        await until(() => features.samples?.length === 2, "samples");
        const exported: File = features.exportCsv();
        assert.equal(exported.type, "text/csv");
        assert.match(exported.name, /\.csv$/);
        assert.equal(await exported.text(), csv);
        const other = m.mark(`<webwriter-feature-engineering></webwriter-feature-engineering>`);
        (await other.importCsv(exported))();
        assert.deepEqual(other.samples, csvSamples);
        assert.isNull(m.mark(`<webwriter-feature-engineering></webwriter-feature-engineering>`).exportCsv(), "no dataset, no file");
      });
      it("takes a table and becomes a table, both ways", async function () {
        const features = m.mark(`<webwriter-feature-engineering></webwriter-feature-engineering>`);
        const source = fragment(`<table><thead><tr><th>name</th><th>size</th></tr></thead><tbody><tr><td>small</td><td>1</td></tr><tr><td>large</td><td>2</td></tr></tbody></table>`);
        assert.notEqual(features.loadTable(source), false);
        assert.deepEqual(features.samples, [{ name: "small", size: "1" }, { name: "large", size: "2" }]);
        const table: HTMLTableElement = features.toTable();
        assert.equal(table.tagName, "TABLE");
        assert.deepEqual([...table.rows].map((row) => [...row.cells].map((cell) => cell.textContent)), [["name", "size"], ["small", "1"], ["large", "2"]]);
        assert.isFalse(features.loadTable(fragment(`<table><tr><th>a</th><th>a</th></tr><tr><td>1</td><td>2</td></tr></table>`)), "declines a table with equal column names");
        assert.isFalse(features.loadTable(fragment(`<p>no table</p>`)), "declines input without a table");
      });
    });

    describe("model designing", function () {
      it("exports the design as JSON and imports it again unchanged", async function () {
        const designing = m.mark(`<webwriter-model-designing></webwriter-model-designing>`);
        assert.isNull(designing.exportDesign(), "an empty design has no file");
        const apply = await designing.importDesign(file(design, "design.json", "application/json"));
        assert.lengthOf(designing.layers, 0, "nothing changes before the apply function runs");
        apply();
        assert.deepEqual(designing.layers.map((layer: any) => layer.type), ["input", "fcl"], "entries that are no layer are left out");
        await until(() => blocks(designing)[0] && dataOf(designing).design?.length === 2, "block write");
        const exported: File = designing.exportDesign();
        assert.equal(exported.type, "application/json");
        const text = await exported.text();
        const other = m.mark(`<webwriter-model-designing></webwriter-model-designing>`);
        (await other.importDesign(exported))();
        assert.equal(await other.exportDesign().text(), text);
      });
      it("refuses a file without layers", async function () {
        const designing = m.mark(`<webwriter-model-designing></webwriter-model-designing>`);
        assert.match(await rejects(designing.importDesign(file("[]", "d.json"))), /no model layers/);
        assert.match(await rejects(designing.importDesign(file("nope", "d.json"))), /not valid JSON/);
      });
    });

    describe("model training", function () {
      let training: any;
      before(async () => {
        training = m.mark(`<webwriter-model-training></webwriter-model-training>`);
        await until(() => training.hasUpdated, "rendered");
      });
      it("publishes the history and the latest validation loss as signals", function () {
        assert.deepEqual(training.signals.history.get(), { columns: ["epoch"], rows: [] });
        assert.isNull(training.signals.loss.get());
        assert.isNull(training.exportHistory(), "no history, no file");
        assert.isNull(training.toTable());
        const history = training.signals.history;
        training.losses = { Training_Loss: [0.9, 0.5], Validation_Loss: [1, 0.6] };
        training.publishHistory();
        assert.strictEqual(training.signals.history, history, "the signal instance stays the same");
        assert.deepEqual(training.signals.history.get(), { columns: ["epoch", "Training Loss", "Validation Loss"], rows: [[1, 0.9, 1], [2, 0.5, 0.6]] });
        assert.equal(training.signals.loss.get(), 0.6);
      });
      it("exports the history as CSV and as a table", async function () {
        const exported: File = training.exportHistory();
        assert.equal(exported.type, "text/csv");
        assert.equal(await exported.text(), "epoch,Training Loss,Validation Loss\r\n1,0.9,1\r\n2,0.5,0.6\r\n");
        assert.equal(training.toTable().rows.length, 3);
      });
      it("exports the best checkpoint as JSON", async function () {
        assert.isNull(training.exportModel(), "no checkpoint, no file");
        training.modelVersions = { "epoch-2": '{"n":2}', "epoch-10": '{"n":10}' };
        assert.equal(await training.exportModel().text(), '{"n":10}', "the latest epoch");
        training.modelVersions = { ...training.modelVersions, best: '{"n":"best"}' };
        const exported: File = training.exportModel();
        assert.equal(exported.type, "application/json");
        assert.equal(await exported.text(), '{"n":"best"}');
      });
      it("clears the history on reset", function () {
        training.resetModel();
        assert.deepEqual(training.signals.history.get().rows, []);
        assert.isNull(training.signals.loss.get());
      });
    });
  });
}

mocha.run();
