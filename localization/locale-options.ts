import type { LocalizeOptions } from "@webwriter/lit/localize";
// @ts-ignore The Lit localization CLI generates this JavaScript module.
import { sourceLocale, targetLocales } from "./generated/locale-codes.js";

/** The locales of the package: the catalogs that `lit-localize` generates. */
export const localeOptions: LocalizeOptions = {
  sourceLocale,
  targetLocales,
  load: locale => import(`./generated/${locale}.ts`),
  drawer: true,
};
