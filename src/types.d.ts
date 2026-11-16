declare module "@webwriter/build/test" {
  export const getMochaConfig: () => Mocha.MochaOptions;
}

// Declarations that the shared WebWriter build types lack.

declare module "papaparse" {
  export interface ParseResult<T> {
    data: T[];
    errors: unknown[];
    meta: { fields?: string[]; [key: string]: unknown };
  }
  export interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
    complete?(results: ParseResult<T>): void;
  }
  const Papa: {
    parse<T = Record<string, any>>(input: File | string, config: ParseConfig<T>): void;
  };
  export default Papa;
}

// The widgets add these in order to serialize datasets with JSON.stringify.
interface BigInt {
  toJSON(): string;
}
interface Uint8Array<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike> {
  toJSON(): string;
}
