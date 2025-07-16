const { app, BrowserWindow, Menu } = require('electron/main')
const path = require('path')
const { startServer, setConfigCallback } = require('./api/server');
const { setWindowParams, setCreateWindowFunction } = require('./ipc/handlers');
require('@electron/remote/main').initialize()


let mainWindow = null;

const createWindow = (width = 1200, height = 800, page = '', params = []) => {
  const win = new BrowserWindow({
    width,
    height,
    backgroundColor: '#1a1a1a', // 设置窗口背景色
    show: false, // 先不显示窗口
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true, // 确保开发者工具可用
      webSecurity: true,
      sandbox: false
    }
  });

  require('@electron/remote/main').enable(win.webContents);

  if (mainWindow == null && page == "") {
    mainWindow = win;
  }

  const winid = win.id;
  // 将参数存储到Map中
  setWindowParams(winid, { page, params });
  
  // 立即设置 localStorage，包含窗口ID
  win.webContents.executeJavaScript(`
    localStorage.setItem('windowId', '${winid}');
  `);
  
  // 设置 CSP
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' ws: wss: http: https:; " +
          "worker-src blob:;"
        ]
      }
    });
  });

  // 在开发环境中加载 webpack dev server
  if (process.env.NODE_ENV === 'development') {
    console.log("开发模式");
    win.loadURL('http://localhost:3000/')
  } else {
    console.log("生产模式");
    win.loadFile(path.join(__dirname, 'public/index.html'))
  }
  
  // 等待页面加载完成后再显示窗口
  win.webContents.on('did-finish-load', () => {
    win.show();
  });

  // 监听 F12 按键
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  Menu.setApplicationMenu(null); // 移除菜单栏
  return win;
}

// 设置 createWindow 函数
setCreateWindowFunction(createWindow);

app.whenReady().then(async () => {
  // 启动 API 服务器
  try {
    await startServer();
  } catch (error) {
    console.error('启动 API 服务器失败:', error);
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 提供一个通过mainWindow send获取App.js config的函数
function requestConfigFromRenderer(key) {
  return new Promise((resolve) => {
    if (!mainWindow) return resolve(null);
    const { ipcMain } = require('electron');
    ipcMain.once('get-config-reply', (event, value) => {
      resolve(value);
    });
    mainWindow.webContents.send('get-config', key);
  });
}

// 启动时注入
// setConfigCallback(requestConfigFromRenderer);

module.exports = {
  createWindow,
  setConfigRequestHandler: setConfigCallback
};
