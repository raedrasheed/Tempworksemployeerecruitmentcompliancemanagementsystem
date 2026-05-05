export const SUPPORTED_LOCALES = ['en', 'sk', 'de', 'ru', 'ar', 'tr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: readonly Locale[] = ['ar'];
export const FALLBACK_LOCALE: Locale = 'en';
export const DEFAULT_NS = 'common';
export const NAMESPACES = ['common', 'nav', 'auth', 'public', 'enums', 'errors'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  sk: 'Slovenčina',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
  tr: 'Türkçe',
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: 'EN',
  sk: 'SK',
  de: 'DE',
  ru: 'RU',
  ar: 'AR',
  tr: 'TR',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  sk: '🇸🇰',
  de: '🇩🇪',
  ru: '🇷🇺',
  ar: '🇸🇦',
  tr: '🇹🇷',
};

export const STORAGE_KEY = 'tempworks.lang';

export const dirOf = (l: Locale): 'rtl' | 'ltr' =>
  RTL_LOCALES.includes(l) ? 'rtl' : 'ltr';

export const isSupportedLocale = (val: unknown): val is Locale =>
  typeof val === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(val);

/**
 * Normalize an input (BCP-47 tag, legacy free-text profile value, etc.) into
 * one of our SUPPORTED_LOCALES. Falls back to FALLBACK_LOCALE.
 */
export function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) return FALLBACK_LOCALE;
  const lower = input.toLowerCase();
  const base = lower.split(/[-_]/)[0];
  if (isSupportedLocale(base)) return base;

  const legacyMap: Record<string, Locale> = {
    english: 'en',
    arabic: 'ar',
    german: 'de',
    deutsch: 'de',
    russian: 'ru',
    russkiy: 'ru',
    slovak: 'sk',
    slovenčina: 'sk',
    slovencina: 'sk',
    turkish: 'tr',
    turkce: 'tr',
    türkçe: 'tr',
  };
  if (lower in legacyMap) return legacyMap[lower];
  return FALLBACK_LOCALE;
}
