import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'antd/dist/reset.css';
import './styles/index.css';

import config from './assets/js/config';

await config.init();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
); 