import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from './index';
import {
  dirOf,
  isSupportedLocale,
  normalizeLocale,
  STORAGE_KEY,
  type Locale,
} from './config';

interface LanguageContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (l: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyDocumentAttributes(locale: Locale) {
  const dir = dirOf(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const detected = i18n.resolvedLanguage ?? i18n.language;
    return isSupportedLocale(detected) ? detected : normalizeLocale(detected);
  });

  // Apply <html lang>/<html dir> immediately on first render and whenever the locale changes.
  useEffect(() => {
    applyDocumentAttributes(locale);
  }, [locale]);

  // Keep our state in sync if i18next changes language elsewhere (e.g. the detector
  // running on init, or another component calling i18n.changeLanguage directly).
  useEffect(() => {
    const handler = (lng: string) => {
      const next = isSupportedLocale(lng) ? lng : normalizeLocale(lng);
      setLocaleState(prev => (prev === next ? prev : next));
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    dir: dirOf(locale),
    setLocale: (l: Locale) => {
      void i18n.changeLanguage(l);
      try { localStorage.setItem(STORAGE_KEY, l); } catch {/* ignore quota / privacy mode */}
      setLocaleState(l);
    },
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
