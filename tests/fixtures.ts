/** A dataset as CSV with a quoted value, a comma and an empty cell. */
export const csv = `name,size,note\r\nsmall,1,"has, comma"\r\nlarge,2,\r\n`;

export const csvSamples = [
  { name: "small", size: "1", note: "has, comma" },
  { name: "large", size: "2", note: "" },
];

/** The same dataset as JSON, with a number and a null that become text. */
export const json = JSON.stringify([
  { name: "small", size: 1, note: "has, comma" },
  { name: "large", size: 2, note: null },
]);

/** A design with an input and a dense layer, as the model designer stores it. */
export const design = JSON.stringify([
  { id: 1, posX: 40, posY: 60, inputConnections: {}, type: "input", valid: true, select: "size" },
  { id: 2, posX: 240, posY: 60, inputConnections: { input_1: { node: "1", input: "output_1" } }, type: "fcl", valid: true, dim: 5 },
  { note: "not a layer" },
]);
