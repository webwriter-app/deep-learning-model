import {sourceLocale, targetLocales} from './locale-codes.js';
import {configureLocalization} from '@lit/localize';
const localizer = configureLocalization({sourceLocale, targetLocales, loadLocale: (locale) => import(`./${locale}.ts`)});
const locales = new Map([sourceLocale, ...targetLocales].map(locale => [locale.toLowerCase(), locale]));

function resolveLocale(locale) {
  const requested = String(locale ?? '').replaceAll('_', '-').toLowerCase();
  const exact = locales.get(requested);
  if (exact) return exact;
  const language = locales.get(requested.split('-')[0]);
  return language ?? sourceLocale;
}

export default {
  getLocale: localizer.getLocale,
  setLocale: locale => localizer.setLocale(resolveLocale(locale)),
};
