// Lightweight i18n. Strings live in strings.json ({ key: { ru,en,de,fr,es } }).
// Language = device locale on first launch (no native module needed), or the
// user's in-app choice, persisted. t(key, params) fills {placeholders}.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import STRINGS from './strings.json';

export const LANGS = ['ru', 'en', 'de', 'fr', 'es'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  ru: 'Русский', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español',
};

const KEY = 'lang.v1';
type Dict = Record<string, Record<string, string>>;
const DICT = STRINGS as Dict;

/** Device language via RN natives — no expo-localization / native rebuild. */
function deviceLang(): Lang {
  let raw = 'en';
  try {
    if (Platform.OS === 'ios') {
      const s = NativeModules.SettingsManager?.settings;
      raw = s?.AppleLocale || s?.AppleLanguages?.[0] || 'en';
    } else {
      raw = NativeModules.I18nManager?.localeIdentifier || 'en';
    }
  } catch {
    raw = 'en';
  }
  const two = raw.slice(0, 2).toLowerCase() as Lang;
  return (LANGS as readonly string[]).includes(two) ? two : 'en';
}

interface I18n {
  lang: Lang;
  /** null = follow the device; a Lang = explicit user override. */
  override: Lang | null;
  setLang: (l: Lang | null) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<Lang | null>(null);
  const [device] = useState<Lang>(deviceLang);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && (LANGS as readonly string[]).includes(v)) setOverride(v as Lang);
    }).catch(() => {});
  }, []);

  const lang = override ?? device;

  const value = useMemo<I18n>(() => ({
    lang,
    override,
    setLang: (l) => {
      setOverride(l);
      if (l) AsyncStorage.setItem(KEY, l).catch(() => {});
      else AsyncStorage.removeItem(KEY).catch(() => {});
    },
    t: (key, params) => {
      const row = DICT[key];
      let s = (row && (row[lang] ?? row.en ?? row.ru)) ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return s;
    },
  }), [lang, override]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}

/** Convenience: just the translator. */
export function useT() {
  return useI18n().t;
}
