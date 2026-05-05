import i18n from './index';
import type { Locale } from './config';

/**
 * BCP-47 tag for Intl APIs. We mostly pass the bare locale code (`en`, `de`,
 * `ar`, …) — the platform falls back to the default region for each language.
 * Override here if you want a specific regional formatting (e.g. `ar-SA`).
 */
function intlLocale(): string {
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? 'en') as Locale | string;
  return lang;
}

export function formatDate(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(), options).format(date);
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return formatDate(value, options);
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return new Intl.NumberFormat(intlLocale(), options).format(value);
}

/**
 * Format an amount as a currency string for the active locale. The currency
 * argument must be a 3-letter ISO 4217 code; falls back to plain number
 * formatting if it isn't.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'EUR',
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const code = (currency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return formatNumber(value, options);
  }
  return new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency: code,
    ...options,
  }).format(value);
}
