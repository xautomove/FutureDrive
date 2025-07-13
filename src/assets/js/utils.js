/**
 * 通用工具方法库
 */
const path = window.require('path');
import ipcController from '../../controller/gui/IpcController';

/**
 * 格式化日期时间
 * @param {Date|string|number} date 日期对象/时间戳/日期字符串
 * @param {string} format 格式化模板，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 生成UUID
 * @returns {string} UUID字符串
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * 日志类型常量
 */
export const LOG_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * 日志管理
 */
const logListeners = new Set();
const pendingLogs = [];

export const addLogListener = (listener) => {
  logListeners.add(listener);
  // 新监听器注册时，补发所有队列日志
  if (pendingLogs.length > 0) {
    pendingLogs.forEach(log => listener(log));
    pendingLogs.length = 0;
  }
};

export const removeLogListener = (listener) => {
  logListeners.delete(listener);
};

/**
 * 添加日志
 * @param {string} message 日志内容
 * @param {string} type 日志类型 (info|warning|error)
 */
export const log = (message, type = LOG_TYPES.INFO) => {
  const now = new Date();
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const timestamp = `${mm}${ss}${ms}`; // 只显示分:秒.毫秒
  const logEntry = { type, message, timestamp };

  // 如果window.isMainWindow未定义或为null，等待一段时间再检查
  if (window.isMainWindow === undefined || window.isMainWindow === null) {
    // 将日志先保存到pendingLogs
    pendingLogs.push(logEntry);
    
    // 100ms后重试
    setTimeout(() => {
      if (window.isMainWindow == 1) {
        if (logListeners.size > 0) {
          logListeners.forEach(listener => {
            listener(logEntry);
          });
        }
      } else {
        ipcController.send('log-message', logEntry);
      }
    }, 200);
    return;
  }

  if (window.isMainWindow == 1) {
    if (logListeners.size === 0) {
      pendingLogs.push(logEntry);
    } else {
      logListeners.forEach(listener => {
        listener(logEntry);
      });
    }
  } else {
    // 发送到主窗口
    ipcController.send('log-message', logEntry);
  }
};

// 文件类型判断
export const FILE_TYPES = {
  CODE: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala'],
    name: 'code'
  },
  DOCUMENT: {
    extensions: ['.md', '.txt', '.json', '.xml', '.html', '.css', '.scss', '.less', '.yaml', '.yml', '.ini', '.conf', '.config'],
    name: 'document'
  }
};

export const getFileType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (FILE_TYPES.CODE.extensions.includes(ext)) {
    return FILE_TYPES.CODE.name;
  }
  if (FILE_TYPES.DOCUMENT.extensions.includes(ext)) {
    return FILE_TYPES.DOCUMENT.name;
  }
  return null;
};