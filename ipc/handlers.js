const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { net } = require('electron');
const si = require('systeminformation');
const path = require('path');
const { startServer, stopServer, restartServer, setProjectPath: setApiProjectPath } = require('../api/server');

let currentDownload = null;

const windowParamsMap = new Map();

let currentProjectPath = null;

let createWindowFunction = null;

function setCreateWindowFunction(func) {
  createWindowFunction = func;
}

function setProjectPath(path) {
  currentProjectPath = path;
}

function getProjectPath() {
  return currentProjectPath;
}

ipcMain.handle('open_window', async (event, width = 1200, height = 800, page = '', params = []) => {
  if (createWindowFunction) {
    createWindowFunction(width, height, page, params);
  } else {
    console.error('createWindow 函数未设置');
  }
  return { width, height, page, params };
});

ipcMain.handle('set-project-path', async (event, path) => {
  setProjectPath(path);
  setApiProjectPath(path);
  return { success: true };
});

ipcMain.handle('get-project-path', async () => {
  return { path: currentProjectPath };
});

ipcMain.handle('get-window-params', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const params = windowParamsMap.get(win.id);
    return params || { page: '', params: [] };
  }
  return { page: '', params: [] };
});

ipcMain.handle('save-dialog', async (event, options) => {
  const { filePath } = await dialog.showSaveDialog(options);
  return { filePath };
});

ipcMain.handle('write-file', async (event, { filePath, content }) => {
  await fsPromises.writeFile(filePath, content, 'utf8');
  return { success: true };
});

ipcMain.on('log-message', (event, logEntry) => {
  
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    const params = windowParamsMap.get(win.id);
    if (params && params.page === '') {
      win.webContents.send('log-message', logEntry);
      break;
    }
  }
});

ipcMain.handle('net-request', async (event, options) => {
  return new Promise((resolve, reject) => {
    const request = net.request(options);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          data: data
        });
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
});

ipcMain.handle('download-file', async (event, { url, savePath }) => {
  return new Promise((resolve, reject) => {
    try {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      let receivedBytes = 0;
      let totalBytes = 0;
      let writeStream = null;
      let lastProgress = 0;

      currentDownload = {
        request,
        writeStream: null
      };

      const cleanup = (error) => {
        try {
          if (writeStream) {
            writeStream.end();
            writeStream = null;
          }
          if (currentDownload) {
            currentDownload = null;
          }
          if (error) {
            reject(error);
          }
        } catch (cleanupError) {
          console.error('清理资源时出错:', cleanupError);
          reject(cleanupError);
        }
      };

      request.on('response', (response) => {
        try {
          totalBytes = parseInt(response.headers['content-length'] || '0', 10);

          if (totalBytes <= 0) {
            event.sender.send('download-progress', 100);
            cleanup();
            resolve({
              success: true,
              path: savePath,
              size: 0,
              message: '文件大小为0或无法获取大小'
            });
            return;
          }
          
          writeStream = fs.createWriteStream(savePath);
          currentDownload.writeStream = writeStream;

          response.on('data', (chunk) => {
            try {
              if (writeStream) {
                receivedBytes += chunk.length;
                writeStream.write(chunk);
                
                if (totalBytes > 0) {
                  const progress = receivedBytes / totalBytes;
                  const currentProgress = Math.floor(progress * 100);
                  
                  if (currentProgress >= lastProgress + 0.5 || currentProgress === 100) {
                    event.sender.send('download-progress', currentProgress);
                    lastProgress = currentProgress;
                  }
                }
              }
            } catch (dataError) {
              cleanup(dataError);
            }
          });

          response.on('end', () => {
            try {
              if (writeStream) {
                writeStream.end();
                if (lastProgress < 100) {
                  event.sender.send('download-progress', 100);
                }
                cleanup();
                resolve({
                  success: true,
                  path: savePath,
                  size: receivedBytes
                });
              }
            } catch (endError) {
              cleanup(endError);
            }
          });

          response.on('error', (error) => {
            cleanup(error);
          });

        } catch (responseError) {
          cleanup(responseError);
        }
      });

      request.on('error', (error) => {
        cleanup(error);
      });

      if (writeStream) {
        writeStream.on('error', (error) => {
          cleanup(error);
        });
      }

      request.end();
    } catch (error) {
      console.error('下载处理出错:', error);
      reject(error);
    }
  });
});

ipcMain.handle('stop-download', async () => {
  if (currentDownload) {
    const { request, writeStream } = currentDownload;
    
    if (writeStream) {
      writeStream.end();
    }
    
    request.abort();
    currentDownload = null;
    
    return { success: true };
  }
  return { success: false, message: '没有正在进行的下载' };
});

ipcMain.handle('get-sys-info', async () => {
  const osInfo = await si.osInfo();
  return osInfo;
});

ipcMain.handle('start-server', async (event, config) => {
  try {
    global.serverConfig = config;
    await startServer();
    return { success: true };
  } catch (error) {
    console.error('启动服务器失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-server', async () => {
  try {
    await stopServer();
    return { success: true };
  } catch (error) {
    console.error('停止服务器失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restart-server', async () => {
  try {
    await restartServer();
    return { success: true };
  } catch (error) {
    console.error('重启服务器失败:', error);
    return { success: false, error: error.message };
  }
});

function setWindowParams(winId, params) {
  windowParamsMap.set(winId, params);
}

module.exports = {
  setWindowParams,
  setCreateWindowFunction,
  setProjectPath,
  getProjectPath
}; 