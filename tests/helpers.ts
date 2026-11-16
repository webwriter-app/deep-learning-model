export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function until(condition: () => unknown, what: string, limit = 30000) {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > limit) throw new Error(`timeout waiting for ${what}`);
    await frame();
  }
}

export const block = (value: unknown) =>
  `<script type="application/json" slot="data">${JSON.stringify(value)}</script>`;
export const blocks = (widget: Element) =>
  [...widget.querySelectorAll<HTMLScriptElement>(':scope > script[type="application/json"][slot="data"]')];
export const dataOf = (widget: Element) => JSON.parse(blocks(widget)[0].textContent!);

export type Mode = "read" | "edit";
export const modes: Mode[] = ["read", "edit"];

/** Edit mode is contenteditable on the widget plus designMode on the document; read mode is neither. */
export function mounting(mode: Mode) {
  const editing = mode === "edit";
  const host = document.createElement("div");
  return {
    host,
    start() {
      document.designMode = editing ? "on" : "off";
      document.body.append(host);
    },
    stop() {
      host.remove();
      document.designMode = "off";
    },
    mark(html: string): any {
      host.insertAdjacentHTML("beforeend", html);
      const widget = host.lastElementChild!;
      if (editing) widget.setAttribute("contenteditable", "");
      return widget;
    },
  };
}
