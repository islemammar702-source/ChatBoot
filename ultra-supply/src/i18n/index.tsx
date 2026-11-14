import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fr, type Dict, type DictKey } from './fr';
import { en } from './en';
import { ar } from './ar';
import { api } from '@/lib/api';
import type { ContentRow, Locale, Translated } from '@/lib/types';

export const dictionaries: Record<Locale, Dict> = { fr, en, ar };
export const LOCALES: { code: Locale; label: string; name: string }[] = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ar', label: 'AR', name: 'العربية' },
];

/** Keys that hold one value for every language (contact details, links). */
export const SETTINGS_KEYS: DictKey[] = [
  'contact.phoneValue', 'contact.whatsappValue', 'contact.emailValue', 'contact.mapQuery',
  'social.facebook', 'social.linkedin', 'social.instagram', 'social.youtube',
];
const settingsSet = new Set<string>(SETTINGS_KEYS);

const STORAGE_KEY = 'ultra-supply-locale';

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (l: Locale) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  loc: (value: Translated | null | undefined) => string;
  overrides: Record<string, ContentRow>;
  refreshContent: () => Promise<void>;
}

const I18nContext = createContext<I18nValue | null>(null);

const initialLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en' || saved === 'ar') return saved;
  } catch {
    /* ignore */
  }
  return 'fr';
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [overrides, setOverrides] = useState<Record<string, ContentRow>>({});
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const refreshContent = useCallback(async () => {
    try {
      const rows = await api.listContent();
      setOverrides(Object.fromEntries(rows.map((r) => [r.key, r])));
    } catch {
      /* fall back to built-in dictionaries */
    }
  }, []);

  useEffect(() => {
    void refreshContent();
  }, [refreshContent]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale, dir]);

  const t = useCallback<I18nValue['t']>(
    (key, vars) => {
      const o = overrides[key];
      const l: Locale = settingsSet.has(key) ? 'fr' : locale;
      let s = o?.[l]?.trim() ? o[l] : dictionaries[l][key] ?? dictionaries.fr[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [locale, overrides],
  );

  const loc = useCallback<I18nValue['loc']>(
    (value) => (value ? value[locale]?.trim() || value.fr || value.en || '' : ''),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, dir, setLocale: setLocaleState, t, loc, overrides, refreshContent }),
    [locale, dir, t, loc, overrides, refreshContent],
  ) as I18nValue;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
