/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-model-designing";
import { block, dataOf, frame, modes, mounting, until } from "./helpers";

mocha.setup(getMochaConfig());

const layer = (id: number, type: string, extra = {}) =>
  ({ id, posX: 40 + id * 200, posY: 60, inputConnections: {}, type, valid: true, ...extra });
const design = () => [
  layer(1, "input", { select: "a" }),
  { ...layer(2, "fcl", { dim: 5 }), inputConnections: { input_1: { node: "1", input: "output_1" } } },
  { ...layer(3, "output", { select: "b", loss: "MSE" }), inputConnections: { input_1: { node: "2", input: "output_1" } } },
];

for (const mode of modes) {
  describe(`model editor on Scene (${mode} mode)`, function () {
    this.timeout(40000);
    const m = mounting(mode);
    let modeled: any;
    const editor = () => modeled.currentCanvas;
    const scene = () => editor().shadowRoot.querySelector("ww-scene");
    const nodes = (): any[] => [...editor().shadowRoot.querySelectorAll("ww-node")];
    const paths = (): any[] => [...editor().shadowRoot.querySelectorAll("ww-path")];
    const stored = () => dataOf(modeled).design;
    const fire = (type: string, detail: unknown) =>
      scene().dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, cancelable: true, detail }));

    before(async function () {
      m.start();
      await customElements.whenDefined("webwriter-model-designing");
      modeled = m.mark(`<webwriter-model-designing>${block({ design: design() })}</webwriter-model-designing>`);
    });
    after(() => m.stop());

    it("shows the stored layers and connections", async function () {
      await until(() => modeled.hasUpdated && nodes().length === 3, "three nodes");
      assert.deepEqual(paths().map((path) => [path.getAttribute("from"), path.getAttribute("to")]), [["1:output_1", "2:input_1"], ["2:output_1", "3:input_1"]], "wires");
      assert.deepEqual(nodes().map((node) => [node.getAttribute("x"), node.getAttribute("y")]), [["240", "60"], ["440", "60"], ["640", "60"]], "positions");
      assert.equal(modeled.layers.length, 3, "layers");
      assert.isNotNull(scene(), "scene present");
    });

    it("follows the dataset shapes and counts the parameters", async function () {
      modeled.sizes = { a: [4], b: [5] };
      await until(() => modeled.shadowRoot.querySelector("#params")?.textContent === "25", "25 parameters");
      assert.equal(modeled.shadowRoot.querySelector("#numberNodes").textContent, "1", "operations");
      const labels = [...editor().shadowRoot.querySelectorAll(".port")].map((port: any) => port.textContent.trim());
      assert.deepEqual(labels, ["4", "4", "5", "5"], "port labels");
      assert.isFalse(nodes().some((node) => node.classList.contains("invalid")), "all layers valid");
      modeled.sizes = { a: [4], b: [6] };
      await until(() => nodes()[2].classList.contains("invalid"), "output layer invalid for the wrong size");
      modeled.sizes = { a: [4], b: [5] };
    });

    it("moving a node writes its position to the block", async function () {
      fire("ww-move", { items: [{ key: "1", x: 15, y: 25 }], dx: 0, dy: 0 });
      await until(() => stored()[0].posX === 15 && stored()[0].posY === 25, "block write");
      assert.equal(nodes()[0].getAttribute("x"), "15", "node moved");
    });

    it("a drag of a node is one transaction and moves it", async function () {
      const events: string[] = [];
      modeled.addEventListener("ww-transactionstart", () => events.push("start"));
      modeled.addEventListener("ww-transactionend", () => events.push("end"));
      const target = nodes()[1].querySelector(".content p");
      const box = target.getBoundingClientRect();
      const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const send = (type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 7, button: 0, isPrimary: true, clientX: x, clientY: y }));
      send("pointerdown", at.x, at.y);
      send("pointermove", at.x + 6, at.y + 6);
      await frame();
      send("pointermove", at.x + 40, at.y + 30);
      await frame();
      send("pointerup", at.x + 40, at.y + 30);
      await until(() => events.includes("end"), "transaction end");
      assert.deepEqual(events.slice(0, 1), ["start"], "transaction start first");
      assert.isAbove(stored()[1].posX, 400 + 20, "moved to the right");
    });

    it("a transaction is opened on the widget, not on the editor inside it", async function () {
      const origins: Element[] = [];
      const inner: Element[] = [];
      modeled.addEventListener("ww-transactionstart", (event: Event) => origins.push(event.target as Element));
      editor().addEventListener("ww-transactionstart", (event: Event) => inner.push(event.target as Element));
      const target = nodes()[2].querySelector(".content p");
      const startX = stored()[2].posX;
      const box = target.getBoundingClientRect();
      const send = (type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 9, button: 0, isPrimary: true, clientX: x, clientY: y }));
      const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      send("pointerdown", at.x, at.y);
      send("pointermove", at.x + 6, at.y + 6);
      await frame();
      send("pointermove", at.x + 30, at.y + 20);
      await frame();
      send("pointerup", at.x + 30, at.y + 20);
      await until(() => stored()[2].posX > startX + 10, "the node moved");
      assert.isTrue(origins.every((origin) => origin === modeled), "every transaction starts on the widget");
      assert.isAbove(origins.length, 0, "a transaction was opened");
      assert.lengthOf(inner, 0, "the editor inside never sees a transaction start of its own");
    });

    it("a click on a wire selects it by the port the wire ends in", async function () {
      const path = paths()[0];
      scene().dispatchEvent(new CustomEvent("ww-select", { bubbles: true, composed: true, cancelable: true, detail: { keys: [path.key], items: [path] } }));
      await until(() => modeled.hasSelection === true, "selected wire");
      await until(() => path.hasAttribute("selected"), "wire marked selected");
      modeled.deleteSelection();
      await until(() => stored()[1].inputConnections.input_1 === undefined, "the wire into the second layer is gone");
      assert.isDefined(stored()[2].inputConnections.input_1, "the other wire stays");
      assert.isTrue(fire("ww-connect", { from: "1:output_1", to: "2:input_1", kind: "wire" }), "connection accepted again");
      await until(() => stored()[1].inputConnections.input_1?.node === "1", "reconnected");
    });

    it("Center View centres the layers at scale 1", async function () {
      const layers = stored();
      const mean = layers.reduce((sum: number, l: any) => sum + l.posX, 0) / layers.length;
      editor().zoomReset();
      const sceneBox = scene().getBoundingClientRect();
      const offset = () => nodes()[0].getBoundingClientRect().left - (sceneBox.left + sceneBox.width / 2);
      await until(() => Math.abs(offset() - (layers[0].posX - mean)) < 2, "the first layer at its place around the middle");
    });

    it("connecting, disconnecting and deleting change the design", async function () {
      fire("ww-select", { keys: ["3:input_1"], items: [paths()[1]] });
      await until(() => modeled.hasSelection === true, "selected wire");
      modeled.deleteSelection();
      await until(() => Object.keys(stored()[2].inputConnections).length === 0, "disconnected");
      assert.equal(paths().length, 1, "one wire left");
      assert.isFalse(fire("ww-connect", { from: "2:output_1", to: "2:input_1", kind: "wire" }), "a layer is not connected to itself");
      assert.isTrue(fire("ww-connect", { from: "2:output_1", to: "3:input_1", kind: "wire" }), "connection accepted");
      await until(() => stored()[2].inputConnections.input_1?.node === "2", "connected");
      assert.equal(paths().length, 2, "two wires again");
      assert.isFalse(fire("ww-connect", { from: "1:output_1", to: "3:input_1", kind: "wire" }), "an input takes one connection");
      fire("ww-select", { keys: ["2"], items: [nodes()[1]] });
      await until(() => modeled.hasSelection === true, "selected node");
      modeled.deleteSelection();
      await until(() => stored().length === 2, "node removed");
      assert.deepEqual(stored().map((l: any) => l.id), [1, 2], "ids renumbered");
      assert.equal(stored()[1].type, "output", "the output layer is now second");
      assert.deepEqual(stored()[1].inputConnections, {}, "its connection is gone");
    });

    it("the palette adds a layer in the middle and a form changes a setting", async function () {
      const before = stored().length;
      ([...modeled.shadowRoot.querySelectorAll("#add sl-button")] as HTMLElement[]).find((button) => button.textContent!.trim() === "Linear")!.click();
      await until(() => stored().length === before + 1, "layer added");
      const added = stored().at(-1);
      assert.deepEqual([added.type, added.dim], ["fcl", 50], "default linear layer");
      await until(() => nodes().length === before + 1, "node added");
      const input = nodes().at(-1).querySelector("sl-input");
      input.value = "7";
      input.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
      await until(() => stored().at(-1).dim === 7, "setting written");
      assert.equal(modeled.shadowRoot.querySelector("#numberNodes").textContent, "1", "operations");
    });
  });
}

mocha.run();
