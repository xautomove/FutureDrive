/**
 * HTTP请求封装库
 */

const BASE_URL = 'http://localhost:3000';
const DEFAULT_TIMEOUT = 10000;
const { ipcRenderer } = window.require('electron');

const requestInterceptor = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return config;
};

const responseInterceptor = (response) => {
  if (response.statusCode === 200) {
    return response.data;
  }
  return Promise.reject(response);
};

const errorHandler = (error) => {
  if (error instanceof Error) {
    console.error('请求错误:', error.message);
  } else {
    console.error('请求错误:', error);
  }
  return Promise.reject(error);
};

/**
 * 发送GET请求
 * @param {string} url 请求地址
 * @param {object} params 请求参数
 * @param {object} config 请求配置
 * @returns {Promise} Promise对象
 */
export const get = async (url, params = {}, config = {}) => {
  try {
    if(!url){
      url = '';
    }
    const queryString = new URLSearchParams(params).toString();

    let fullUrl = '';
    if(url.includes('http')){
      fullUrl = `${url}${queryString ? `?${queryString}` : ''}`;
    }else{
      fullUrl = `${BASE_URL}${url}${queryString ? `?${queryString}` : ''}`;
    }
    const response = await ipcRenderer.invoke('net-request', {
      method: 'GET',
      url: fullUrl,
      headers: {
        'Accept': '*/*',
        ...config.headers
      }
    });

    return responseInterceptor(response);
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * 发送POST请求
 * @param {string} url 请求地址
 * @param {object} data 请求数据
 * @param {object} config 请求配置
 * @returns {Promise} Promise对象
 */
export const post = async (url, data = {}, config = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(data),
      ...config
    });

    return responseInterceptor(response);
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * 发送PUT请求
 * @param {string} url 请求地址
 * @param {object} data 请求数据
 * @param {object} config 请求配置
 * @returns {Promise} Promise对象
 */
export const put = async (url, data = {}, config = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(data),
      ...config
    });

    return responseInterceptor(response);
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * 发送DELETE请求
 * @param {string} url 请求地址
 * @param {object} config 请求配置
 * @returns {Promise} Promise对象
 */
export const del = async (url, config = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      ...config
    });

    return responseInterceptor(response);
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * 停止下载
 * @returns {Promise} Promise对象
 */
export const stopDownload = async () => {
  try {
    await ipcRenderer.invoke('stop-download');
    return { success: true };
  } catch (error) {
    return errorHandler(error);
  }
};

/**
 * 下载文件
 * @param {string} url 下载地址
 * @param {string} savePath 保存路径
 * @param {function} onProgress 进度回调函数，参数为进度百分比(0-100)
 * @returns {Promise} Promise对象
 */
export const download = async (url, savePath, onProgress) => {
  try {
    if (!url) {
      throw new Error('下载地址不能为空');
    }

    const fullUrl = url.includes('http') ? url : `${BASE_URL}${url}`;

    const progressListener = (event, progress) => {
      if (typeof onProgress === 'function') {
        onProgress(progress);
      }
    };

    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.on('download-progress', progressListener);

    try {
      const response = await ipcRenderer.invoke('download-file', {
        url: fullUrl,
        savePath: savePath
      });
      return response;
    } finally {
      ipcRenderer.removeListener('download-progress', progressListener);
    }
  } catch (error) {
    return errorHandler(error);
  }
}; 

