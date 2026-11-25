/** A row of the dataset: column name to value. */
export type Sample = Record<string, string>;

/** The table shape that widgets share through signals. */
export type Table = { columns: string[]; rows: (string | number | null)[][] };

/** Why a table cannot become a dataset. */
export type TableProblem = "no-columns" | "duplicate-columns" | "no-rows" | "ragged";

/** The column names of the samples in the order in which they first appear. */
export function columnsOf(samples: Sample[]): string[] {
    const columns = new Set<string>();
    for (const sample of samples) for (const key of Object.keys(sample)) columns.add(key);
    return [...columns];
}

/** Turns a header and rows of cells into samples. Short rows are filled up with empty values. */
export function toSamples(header: unknown[], cells: unknown[][]): { samples: Sample[]; fields: string[] } | TableProblem {
    const fields = header.map(cell => String(cell ?? "").trim());
    if (fields.length === 0 || fields.every(field => field === "")) return "no-columns";
    if (fields.some(field => field === "") || new Set(fields).size !== fields.length) return "duplicate-columns";
    if (cells.length === 0) return "no-rows";
    if (cells.some(row => row.length > fields.length)) return "ragged";
    const samples = cells.map(row => Object.fromEntries(fields.map((field, index) => [field, cellText(row[index])])));
    return { samples, fields };
}

/** Samples from a JSON value: a non-empty array of objects. Other values than text are written as text. */
export function samplesFromJson(value: unknown): { samples: Sample[]; fields: string[] } | TableProblem {
    if (!Array.isArray(value) || !value.every(row => row !== null && typeof row === "object" && !Array.isArray(row))) return "no-columns";
    const fields = columnsOf(value as Sample[]);
    return toSamples(fields, value.map(row => fields.map(field => (row as Record<string, unknown>)[field])));
}

function cellText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** The table of the samples with all their columns. */
export function samplesToTable(samples: Sample[]): Table {
    const columns = columnsOf(samples);
    return { columns, rows: samples.map(sample => columns.map(column => sample[column] ?? null)) };
}

/** A table as CSV text with a header row. */
export function tableToCsv(table: Table): string {
    const quote = (cell: string | number | null) => {
        const text = cell === null ? "" : String(cell);
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    return [table.columns, ...table.rows].map(row => row.map(quote).join(",")).join("\r\n") + "\r\n";
}
