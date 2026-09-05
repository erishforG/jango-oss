import { createContext, useContext, useMemo, useState } from 'react';
import ko from './ko.json';
import en from './en.json';
import ja from './ja.json';

export type Locale = 'ko' | 'en' | 'ja';
export type Currency = 'KRW' | 'USD' | 'JPY';

export const TIMEZONES = [
  { value: 'Asia/Seoul', labelKey: 'timezones.asiaSeoul', offset: '+9' },
  { value: 'Asia/Tokyo', labelKey: 'timezones.asiaTokyo', offset: '+9' },
  { value: 'America/New_York', labelKey: 'timezones.americaNewYork', offset: '-5' },
  { value: 'America/Los_Angeles', labelKey: 'timezones.americaLosAngeles', offset: '-8' },
  { value: 'Europe/London', labelKey: 'timezones.europeLondon', offset: '+0' },
  { value: 'Europe/Berlin', labelKey: 'timezones.europeBerlin', offset: '+1' },
  { value: 'Asia/Singapore', labelKey: 'timezones.asiaSingapore', offset: '+8' },
  { value: 'Asia/Shanghai', labelKey: 'timezones.asiaShanghai', offset: '+8' },
  { value: 'Australia/Sydney', labelKey: 'timezones.australiaSydney', offset: '+10' },
  { value: 'Pacific/Auckland', labelKey: 'timezones.pacificAuckland', offset: '+12' },
] as const;

export type Timezone = (typeof TIMEZONES)[number]['value'];

export const localeCurrencyMap: Record<Locale, Currency> = {
  ko: 'KRW',
  en: 'USD',
  ja: 'JPY',
};

const dictionaries: Record<Locale, Record<string, any>> = {
  ko,
  en,
  ja,
};

interface TranslationContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

function getValueByPath(target: Record<string, any>, key: string): string | undefined {
  return key.split('.').reduce<any>((acc, part) => (acc ? acc[part] : undefined), target);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('ko');

  const value = useMemo(() => {
    const t = (key: string, fallback?: string): string => {
      const found = getValueByPath(dictionaries[locale], key);
      return typeof found === 'string' ? found : fallback || key;
    };

    return { locale, setLocale, t };
  }, [locale]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
