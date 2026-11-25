import type { Table } from "../model/dataset/table";

/** A detached `table` with a header row and one row per entry of the table. */
export function tableElement({ columns, rows }: Table): HTMLTableElement {
  const cell = (tag: "th" | "td", value: string | number | null) => Object.assign(document.createElement(tag), { textContent: value ?? "" });
  const table = document.createElement("table");
  table.createTHead().insertRow().append(...columns.map(column => cell("th", column)));
  const body = table.createTBody();
  for (const row of rows) body.insertRow().append(...row.map(value => cell("td", value)));
  return table;
}
