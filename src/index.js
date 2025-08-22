import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'antd/dist/reset.css';
import './styles/index.css';

import config from './assets/js/config';
import { I18nProvider } from './context/I18nContext';

await config.init();

try {
  const currentLang = config.get('language');
  if (!currentLang) {
    let systemLocale = '';
    try {
      const { app } = window.require('@electron/remote');
      systemLocale = app.getLocale();
    } catch (_) {
      systemLocale = navigator.language || navigator.userLanguage || '';
    }
    const localeLower = String(systemLocale).toLowerCase();
    const autoLang = localeLower.startsWith('en') ? 'en-US' : 'zh-CN';
    await config.set('language', autoLang);
  }
} catch (_) {}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <I18nProvider>
    <App />
  </I18nProvider>
);