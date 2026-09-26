/** Мови інтерфейсу. Ідентифікатори збігаються з іменами файлів public/i18n/<lang>.json. */
export const APP_LANGS = ['ua', 'en'] as const;
export type AppLang = (typeof APP_LANGS)[number];

export const DEFAULT_LANG: AppLang = 'ua';

/** `ua` — назва файлу за вимогою; для HTML/Intl потрібен ISO 639-1 код `uk`. */
export const LANG_META: Record<AppLang, { htmlLang: string; locale: string }> = {
  ua: { htmlLang: 'uk', locale: 'uk-UA' },
  en: { htmlLang: 'en', locale: 'en-US' },
};

export function isAppLang(value: unknown): value is AppLang {
  return typeof value === 'string' && (APP_LANGS as readonly string[]).includes(value);
}

/** Параметри інтерполяції `{{name}}` у перекладах. */
export type TranslateParams = Record<string, string | number>;
