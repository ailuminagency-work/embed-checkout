// Lightweight i18n — no external package needed.
// Provides useTranslation() hook that returns a t(key) function.
// Language is set from app_settings.widget_language ('en' | 'es').

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { createElement } from "react";
import en from "./locales/en";
import es from "./locales/es";

export type Locale = "en" | "es";

export type TranslationKey = keyof typeof en;
type Translations = Record<TranslationKey, string>;

const LOCALES: Record<Locale, Translations> = { en, es } as Record<Locale, Translations>;

const I18nContext = createContext<{ t: (key: TranslationKey) => string }>({
  t: (key) => en[key] ?? key,
});

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useMemo(() => {
    const dict = LOCALES[locale] ?? en;
    return (key: TranslationKey): string => dict[key] ?? en[key] ?? key;
  }, [locale]);

  return createElement(I18nContext.Provider, { value: { t } }, children);
}

export function useTranslation() {
  return useContext(I18nContext);
}
