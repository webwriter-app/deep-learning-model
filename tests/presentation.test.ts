/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-feature-engineering";
import "../src/widgets/webwriter-model-training";
import "../src/widgets/webwriter-model-designing";
import "../src/widgets/webwriter-model-prediction";
import "../src/widgets/webwriter-model-evaluation";
import { DrawingCanvas } from "../src/components/inference-fields/image-input";
import { block, dataOf, frame, modes, mounting, until } from "./helpers";

mocha.setup(getMochaConfig());
customElements.define("test-drawing-canvas", DrawingCanvas);

const tags = ["webwriter-feature-engineering", "webwriter-model-training", "webwriter-model-designing", "webwriter-model-prediction", "webwriter-model-evaluation"];
const layer = (id: number, type: string, extra = {}) =>
  ({ id, posX: 40 + id * 200, posY: 60, inputConnections: {}, type, valid: true, ...extra });
const design = () => [
  layer(1, "input", { select: "a" }),
  { ...layer(2, "fcl", { dim: 5 }), inputConnections: { input_1: { node: "1", input: "output_1" } } },
];

for (const mode of modes) {
  describe(`presentation (${mode} mode)`, function () {
    this.timeout(40000);
    const m = mounting(mode);
    let wrapper: HTMLElement;
    before(async function () {
      m.start();
      await Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
      wrapper = document.createElement("div");
      wrapper.style.cssText = "width:300px;--ww-text-color:rgb(10, 20, 30);--ww-font-family:monospace;--ww-theme-accent-1:rgb(1, 2, 3);--ww-theme-accent-2:rgb(4, 5, 6)";
      m.host.append(wrapper);
    });
    after(() => m.stop());

    const mount = (html: string) => {
      wrapper.insertAdjacentHTML("beforeend", html);
      const widget = wrapper.lastElementChild as any;
      if (mode === "edit") widget.setAttribute("contenteditable", "");
      return widget;
    };

    it("every widget fits 300 px and is limited to 2100 px", async function () {
      for (const tag of tags) {
        const widget = mount(`<${tag}></${tag}>`);
        await until(() => widget.hasUpdated, `${tag} rendered`);
        await frame();
        const style = getComputedStyle(widget);
        assert.equal(style.display, "block", `${tag} is a block`);
        assert.equal(style.maxWidth, "2100px", `${tag} max-width`);
        assert.isAtMost(widget.scrollWidth, 300, `${tag} does not overflow at 300 px`);
        assert.isAtMost(widget.getBoundingClientRect().width, 300, `${tag} width`);
      }
    });

    it("text takes the color and the font of the theme", async function () {
      const training = mount(`<webwriter-model-training></webwriter-model-training>`);
      await until(() => training.hasUpdated, "rendered");
      const style = getComputedStyle(training);
      assert.equal(style.color, "rgb(10, 20, 30)", "host color");
      assert.include(style.fontFamily, "monospace", "host font");
      assert.equal(getComputedStyle(training.shadowRoot.querySelector("#error")).fontFamily, style.fontFamily, "inner font follows");
    });

    it("wires and selection use the accent colors", async function () {
      const modeled = mount(`<webwriter-model-designing>${block({ design: design() })}</webwriter-model-designing>`);
      const editor = () => modeled.currentCanvas;
      await until(() => editor()?.shadowRoot?.querySelector("ww-path"), "a wire");
      const path = editor().shadowRoot.querySelector("ww-path");
      assert.equal(getComputedStyle(path).stroke, "rgb(1, 2, 3)", "wire");
      path.setAttribute("selected", "");
      assert.equal(getComputedStyle(path).stroke, "rgb(4, 5, 6)", "selected wire");
      if (mode === "edit") assert.equal(getComputedStyle(modeled.shadowRoot.querySelector("#add")).position, "static", "the tool bar moves below the canvas at 300 px");
    });

    it("a touch drag moves a layer, and a tap on a port is a target of at least 24 px", async function () {
      const modeled = mount(`<webwriter-model-designing>${block({ design: design() })}</webwriter-model-designing>`);
      const editor = () => modeled.currentCanvas;
      await until(() => editor()?.shadowRoot?.querySelectorAll("ww-node").length === 2, "two nodes");
      const port = editor().shadowRoot.querySelector(".port").getBoundingClientRect();
      assert.isAtLeast(port.width, 24, "port width");
      assert.isAtLeast(port.height, 24, "port height");
      if (mode !== "edit") return;
      const target = editor().shadowRoot.querySelectorAll("ww-node")[1].querySelector(".content p");
      const box = target.getBoundingClientRect();
      const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const send = (type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 11, pointerType: "touch", button: 0, isPrimary: true, clientX: x, clientY: y }));
      const startX = dataOf(modeled).design?.[1]?.posX ?? 440;
      send("pointerdown", at.x, at.y);
      send("pointermove", at.x + 8, at.y + 8);
      await frame();
      send("pointermove", at.x + 50, at.y + 20);
      await frame();
      send("pointerup", at.x + 50, at.y + 20);
      await until(() => modeled.layers[1].posX > startX + 20, "the layer moved by touch");
    });

    it("the keyboard selects a layer, moves it with the arrow keys and deletes it with Delete", async function () {
      const modeled = mount(`<webwriter-model-designing>${block({ design: design() })}</webwriter-model-designing>`);
      const editor = () => modeled.currentCanvas;
      await until(() => editor()?.shadowRoot?.querySelectorAll("ww-node").length === 2, "two nodes");
      if (mode !== "edit") return;
      const node = editor().shadowRoot.querySelectorAll("ww-node")[1] as HTMLElement;
      assert.isAtLeast(node.tabIndex, 0, "a layer is a tab stop");
      node.focus();
      const press = (key: string) => node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true }));
      press(" ");
      await until(() => modeled.hasSelection, "the layer is selected by the space key");
      const startX = modeled.layers[1].posX;
      press("ArrowRight");
      node.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true, composed: true }));
      await until(() => modeled.layers[1].posX > startX, "the layer moved by arrow key");
      press("Delete");
      await until(() => modeled.layers.length === 1, "the layer is deleted by the Delete key");
    });

    it("the editing mode option and the design are stored in the document", async function () {
      const modeled = mount(`<webwriter-model-designing editmode="read">${block({ design: design() })}</webwriter-model-designing>`);
      await until(() => modeled.hasUpdated, "rendered");
      assert.equal(modeled.editMode, "read", "the attribute sets the option");
      modeled.editMode = "hidden";
      await modeled.updateComplete;
      assert.equal(modeled.getAttribute("editmode"), "hidden", "the option is reflected");
      assert.equal(dataOf(modeled).design.length, 2, "the design stays in the data block");
    });

    it("the drawing area draws with a touch pointer and stays still without one", async function () {
      const pad: any = mount(`<test-drawing-canvas></test-drawing-canvas>`);
      await until(() => pad.hasUpdated && pad.shadowRoot.querySelector("canvas") && pad.width, "pad");
      const canvas: HTMLCanvasElement = pad.shadowRoot.querySelector("canvas");
      const ink = () => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0);
      assert.isFalse(ink(), "empty at first");
      const box = canvas.getBoundingClientRect();
      const send = (type: string, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 5, pointerType: "touch", isPrimary: true, clientX: box.left + x, clientY: box.top + y }));
      send("pointermove", 20, 20);
      assert.isFalse(ink(), "a move without a press draws nothing");
      send("pointerdown", 20, 20);
      send("pointermove", 80, 80);
      send("pointermove", 120, 90);
      send("pointerup", 120, 90);
      assert.isTrue(ink(), "the stroke is drawn");
      assert.equal(getComputedStyle(canvas).touchAction, "none", "only the canvas takes the touch");
      assert.notEqual(getComputedStyle(pad).touchAction, "none", "the host leaves scrolling alone");
    });
  });
}

mocha.run();
