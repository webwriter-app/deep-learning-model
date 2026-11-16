/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-feature-engineering";
import "../src/widgets/webwriter-model-training";
import "../src/widgets/webwriter-model-designing";
import "../src/widgets/webwriter-model-prediction";
import { modes, mounting, until } from "./helpers";

mocha.setup(getMochaConfig());

for (const mode of modes) {
  describe(`localization (${mode} mode)`, function () {
    this.timeout(40000);
    const m = mounting(mode);
    let training: any, trainingLang: any, predictionFr: any, features: any;
    before(async function () {
      m.start();
      await Promise.all(["webwriter-feature-engineering", "webwriter-model-training", "webwriter-model-designing", "webwriter-model-prediction"].map((tag) => customElements.whenDefined(tag)));
      features = m.mark(`<webwriter-feature-engineering></webwriter-feature-engineering>`);
      training = m.mark(`<webwriter-model-training></webwriter-model-training>`);
      trainingLang = m.mark(`<webwriter-model-training lang="de"></webwriter-model-training>`);
      predictionFr = m.mark(`<webwriter-model-prediction lang="fr"></webwriter-model-prediction>`);
    });
    after(() => m.stop());

    it("a widget shows the language of its lang attribute, and two widgets differ", async function () {
      await until(() => trainingLang.shadowRoot?.querySelector("#start-training")?.textContent.trim() === "Training starten", "German");
      await until(() => predictionFr.msg("Select Source Element") === "Sélectionner l'élément source", "French");
      assert.equal(trainingLang.msg("Start training"), "Training starten", "msg in German");
      assert.equal(training.msg("Start training"), "Start training", "an unmarked widget stays in the source language");
      assert.equal(trainingLang.getAttribute("lang"), "de", "lang attribute untouched");
    });

    it("a component inside a widget follows the widget's language, also after a change", async function () {
      const select = predictionFr.shadowRoot.querySelector("ref-select");
      const button = () => select.shadowRoot?.querySelector("#btn")?.textContent.trim();
      await until(() => button() && button() !== "Show selection", "button in French");
      assert.notEqual(button(), "Show selection", "still English");
      let drawer = 0;
      predictionFr.addEventListener("optionschange", () => drawer++);
      predictionFr.setAttribute("lang", "de");
      await until(() => button() === "Auswahl anzeigen", "German component text");
      assert.isAbove(drawer, 0, "optionschange after the language change");
      predictionFr.removeAttribute("lang");
      await until(() => button() === "Show selection", "back to the source language");
    });

    it("the model editor inside the designing widget translates its messages", async function () {
      const german = m.mark(`<webwriter-model-designing lang="de"></webwriter-model-designing>`);
      await until(() => german.currentCanvas?.msg?.("Has a cyclic reference.") === "Hat eine zyklische Referenz.", "German in the editor");
    });

    it("the editor's option declarations are unchanged", async function () {
      assert.deepEqual(Object.keys(training.options), ["featureWidgetId", "modelWidgetId", "editMode", "currentBackend", "cache"], "training options");
      assert.deepEqual(Object.keys(features.options), ["editMode"], "feature options");
      assert.deepEqual(Object.keys(features.actions), ["deleteDataset"], "feature actions");
      const label = trainingLang.options.editMode.label;
      assert.isTrue(typeof label === "string" && label !== "Edit permissions", `label in the widget's language: ${JSON.stringify(label)}`);
    });
  });
}

mocha.run();
