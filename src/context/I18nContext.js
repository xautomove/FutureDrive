import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import zhCN from '../i18n/zh';
import enUS from '../i18n/en';
import config from '../assets/js/config';

const I18nContext = createContext({
  lang: 'zh-CN',
  t: (key) => key,
  setLanguage: () => {}
});

const DICTS = {
  'zh-CN': zhCN,
  'en-US': enUS
};

function getByPath(object, path) {
  if (!object) return undefined;
  const segments = String(path).split('.');
  let current = object;
  for (const segment of segments) {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function I18nProvider({ children }) {
  const initialLang = (() => {
    try {
      const saved = config.get('language');
      return saved || 'zh-CN';
    } catch (_) {
      return 'zh-CN';
    }
  })();

  const [lang, setLang] = useState(initialLang);

  const t = useCallback((key, vars) => {
    const dict = DICTS[lang] || {};
    let value = getByPath(dict, key);
    if (typeof value !== 'string') return key;
    if (vars && typeof vars === 'object') {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }
    return value;
  }, [lang]);

  const setLanguage = useCallback((code) => {
    setLang(code);
  }, []);

  const contextValue = useMemo(() => ({ lang, t, setLanguage }), [lang, t, setLanguage]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}


