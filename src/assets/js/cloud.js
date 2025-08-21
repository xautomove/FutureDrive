import config from './config';
import { post } from './http';

const joinUrl = (host, path) => {
  const h = (host || '').replace(/\/$/, '');
  const p = (path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${h}${p}`;
};

export const puts = (type, content, data) => {
  try {
    let apiServer = config.get('api_server');
    if (!apiServer || typeof apiServer !== 'object') {
      try {
        const defaults = config.getDefaultConfig?.();
        apiServer = defaults?.api_server || {};
      } catch (_) {
        apiServer = {};
      }
    }

    const url = joinUrl(apiServer.host, apiServer.logs_add);
    const payload = { type, content, data };

    post(url, payload).catch(() => {});
  } catch (_) {
  }
};

export default { puts };

