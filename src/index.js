import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'antd/dist/reset.css';
import './styles/index.css';

import config from './assets/js/config';
import { I18nProvider } from './context/I18nContext';

try {
  await config.init();
} catch (error) {
  console.error('[RendererBootstrap] 配置初始化失败:', error);
  throw error;
}

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
} catch (error) {
  console.error('[RendererBootstrap] 语言初始化失败:', error);
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('未找到根节点 #root');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
} catch (error) {
  console.error('[RendererBootstrap] React 挂载失败:', error);
  throw error;
}
