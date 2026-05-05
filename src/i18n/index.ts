import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
  NAMESPACES,
  DEFAULT_NS,
  STORAGE_KEY,
} from './config';

import enCommon    from './locales/en/common.json';
import enNav       from './locales/en/nav.json';
import enAuth      from './locales/en/auth.json';
import enPublic    from './locales/en/public.json';
import enEnums     from './locales/en/enums.json';
import enErrors    from './locales/en/errors.json';
import enDashboard from './locales/en/dashboard.json';
import enUi        from './locales/en/ui.json';
import enPages     from './locales/en/pages.json';

import skCommon    from './locales/sk/common.json';
import skNav       from './locales/sk/nav.json';
import skAuth      from './locales/sk/auth.json';
import skPublic    from './locales/sk/public.json';
import skEnums     from './locales/sk/enums.json';
import skErrors    from './locales/sk/errors.json';
import skDashboard from './locales/sk/dashboard.json';
import skUi        from './locales/sk/ui.json';
import skPages     from './locales/sk/pages.json';

import deCommon    from './locales/de/common.json';
import deNav       from './locales/de/nav.json';
import deAuth      from './locales/de/auth.json';
import dePublic    from './locales/de/public.json';
import deEnums     from './locales/de/enums.json';
import deErrors    from './locales/de/errors.json';
import deDashboard from './locales/de/dashboard.json';
import deUi        from './locales/de/ui.json';
import dePages     from './locales/de/pages.json';

import ruCommon    from './locales/ru/common.json';
import ruNav       from './locales/ru/nav.json';
import ruAuth      from './locales/ru/auth.json';
import ruPublic    from './locales/ru/public.json';
import ruEnums     from './locales/ru/enums.json';
import ruErrors    from './locales/ru/errors.json';
import ruDashboard from './locales/ru/dashboard.json';
import ruUi        from './locales/ru/ui.json';
import ruPages     from './locales/ru/pages.json';

import arCommon    from './locales/ar/common.json';
import arNav       from './locales/ar/nav.json';
import arAuth      from './locales/ar/auth.json';
import arPublic    from './locales/ar/public.json';
import arEnums     from './locales/ar/enums.json';
import arErrors    from './locales/ar/errors.json';
import arDashboard from './locales/ar/dashboard.json';
import arUi        from './locales/ar/ui.json';
import arPages     from './locales/ar/pages.json';

import trCommon    from './locales/tr/common.json';
import trNav       from './locales/tr/nav.json';
import trAuth      from './locales/tr/auth.json';
import trPublic    from './locales/tr/public.json';
import trEnums     from './locales/tr/enums.json';
import trErrors    from './locales/tr/errors.json';
import trDashboard from './locales/tr/dashboard.json';
import trUi        from './locales/tr/ui.json';
import trPages     from './locales/tr/pages.json';

const resources = {
  en: { common: enCommon, nav: enNav, auth: enAuth, public: enPublic, enums: enEnums, errors: enErrors, dashboard: enDashboard, ui: enUi, pages: enPages },
  sk: { common: skCommon, nav: skNav, auth: skAuth, public: skPublic, enums: skEnums, errors: skErrors, dashboard: skDashboard, ui: skUi, pages: skPages },
  de: { common: deCommon, nav: deNav, auth: deAuth, public: dePublic, enums: deEnums, errors: deErrors, dashboard: deDashboard, ui: deUi, pages: dePages },
  ru: { common: ruCommon, nav: ruNav, auth: ruAuth, public: ruPublic, enums: ruEnums, errors: ruErrors, dashboard: ruDashboard, ui: ruUi, pages: ruPages },
  ar: { common: arCommon, nav: arNav, auth: arAuth, public: arPublic, enums: arEnums, errors: arErrors, dashboard: arDashboard, ui: arUi, pages: arPages },
  tr: { common: trCommon, nav: trNav, auth: trAuth, public: trPublic, enums: trEnums, errors: trErrors, dashboard: trDashboard, ui: trUi, pages: trPages },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NS,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
