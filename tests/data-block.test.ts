/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-feature-engineering";
import "../src/widgets/webwriter-model-training";
import "../src/widgets/webwriter-model-designing";
import { block, blocks, dataOf, modes, mounting, until, wait } from "./helpers";

mocha.setup(getMochaConfig());

const samples = [{ a: "1", b: "x" }, { a: "2", b: "y" }];
const props = { a: { type: "Number Encoding", settings: null }, b: { type: "Ignore", settings: null } };

const layer = (id: number, type: string, extra = {}) =>
  ({ id, posX: 40 + id * 200, posY: 60, inputConnections: {}, type, valid: true, ...extra });

for (const mode of modes) {
  describe(`data block (${mode} mode)`, function () {
    this.timeout(40000);
    const m = mounting(mode);
    before(async function () {
      m.start();
      await Promise.all(["webwriter-feature-engineering", "webwriter-model-training", "webwriter-model-designing"].map((tag) => customElements.whenDefined(tag)));
    });
    after(() => m.stop());

    describe("feature engineering", function () {
      let features: any;
      before(() => { features = m.mark(`<webwriter-feature-engineering>${block({ samples, fieldProps: props, extra: 1 })}</webwriter-feature-engineering>`); });

      it("reads samples and field settings from the block", async function () {
        await until(() => features.samples?.length === 2, "samples");
        assert.deepEqual(features.fieldProps, props);
      });
      it("writes a changed field setting into the same block and keeps unknown keys", async function () {
        features.fieldProps = { ...features.fieldProps, a: { type: "Ignore", settings: null } };
        await until(() => dataOf(features).fieldProps.a.type === "Ignore", "block write");
        assert.equal(blocks(features).length, 1, "number of data blocks");
        assert.deepEqual(dataOf(features).samples, samples);
        assert.equal(dataOf(features).extra, 1, "unknown key");
        assert.isTrue(blocks(features)[0].getAttribute("slot") === "data" && blocks(features)[0].type === "application/json", "block attributes");
      });
      it("follows an outside change of the block", async function () {
        const next = { samples: [...samples, { a: "3", b: "z" }], fieldProps: { a: { type: "Class Encoding", settings: null } } };
        blocks(features)[0].textContent = JSON.stringify(next);
        await until(() => features.samples?.length === 3 && features.fieldProps.a?.type === "Class Encoding", "outside change");
      });
      it("deleteDataset empties the stored data", async function () {
        features.deleteDataset();
        await until(() => dataOf(features).samples === null, "block cleared");
        assert.deepEqual(dataOf(features).fieldProps, {});
        assert.isNull(features.samples, "samples cleared");
      });
      it("a block that is not JSON is neither overwritten nor does it break the widget", async function () {
        const plain = m.mark(`<webwriter-feature-engineering><script type="application/json" slot="data">{broken</script></webwriter-feature-engineering>`);
        await wait(300);
        assert.isNull(plain.samples, "no samples");
        assert.equal(blocks(plain)[0].textContent, "{broken", "block untouched");
      });
    });

    describe("training", function () {
      let training: any;
      let finished = 0;
      before(() => {
        training = m.mark(`<webwriter-model-training>${block({ modelVersions: { best: "{}" } })}</webwriter-model-training>`);
        training.addEventListener("finished", () => finished++);
      });

      it("reads its model versions from the block", async function () {
        await until(() => training.getAvailableModels?.().length === 1, "model versions");
        assert.deepEqual(training.getAvailableModels(), ["best"]);
      });
      it("writes a checkpoint to the block and announces it", async function () {
        const before = finished;
        training.modelVersions = { ...training.modelVersions, "epoch-1": "{\"x\":1}" };
        assert.isAbove(finished, before, "finished event");
        await until(() => Object.keys(dataOf(training).modelVersions).length === 2, "block write");
        assert.deepEqual(Object.keys(dataOf(training).modelVersions), ["best", "epoch-1"]);
        assert.equal(blocks(training).length, 1, "number of data blocks");
      });
      it("announces an outside change of the block", async function () {
        const before = finished;
        blocks(training)[0].textContent = JSON.stringify({ modelVersions: { z: "1" } });
        await until(() => finished > before, "finished event");
        assert.deepEqual(training.getAvailableModels(), ["z"]);
      });
      it("without a block creates a participant block with its first checkpoint", async function () {
        const fresh = m.mark(`<webwriter-model-training></webwriter-model-training>`);
        await wait(100);
        assert.equal(blocks(fresh).length, 0, "no block before a write");
        fresh.modelVersions = { first: "1" };
        await until(() => blocks(fresh).length === 1, "created block");
        assert.deepEqual(dataOf(fresh), { modelVersions: { first: "1" } });
      });
    });

    describe("model designing", function () {
      it("writes the design to the block without feeding it back, and takes an outside change", async function () {
        const designing = m.mark(`<webwriter-model-designing>${block({ design: [] })}</webwriter-model-designing>`);
        await until(() => designing.currentCanvas && designing.hasUpdated, "first render");
        designing.state = JSON.stringify([layer(1, "input", { select: "a" })]);
        await until(() => dataOf(designing).design?.length === 1, "block write");
        await wait(200);
        assert.equal(designing.layers.length, 0, "echo of the own write");
        blocks(designing)[0].textContent = JSON.stringify({ design: [layer(2, "fcl"), layer(3, "activation")] });
        await until(() => designing.layers.length === 2, "outside change");
        assert.deepEqual(designing.layers.map((l: any) => l.id), [2, 3], "layers shown");
        assert.deepEqual(JSON.parse(designing.state).map((l: any) => l.id), [2, 3], "state getter");
        await until(() => designing.currentCanvas.shadowRoot.querySelectorAll("ww-node").length === 2, "nodes in the scene");
      });
    });
  });
}

mocha.run();
