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
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true,
      webSecurity: true,
      sandbox: false
    }
  });

  require('@electron/remote/main').enable(win.webContents);

  if (mainWindow == null && page == "") {
    mainWindow = win;
  }

  const winid = win.id;
  setWindowParams(winid, { page, params });
  
  win.webContents.executeJavaScript(`
    localStorage.setItem('windowId', '${winid}');
  `);
  
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

  if (process.env.NODE_ENV === 'development') {
    console.log("欢迎使用FutureDrive,交流Q群：791839065");
    win.loadURL('http://localhost:3000/')
  } else {
    win.loadFile(path.join(__dirname, 'public/index.html'))
  }
  
  win.webContents.on('did-finish-load', () => {
    win.show();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  Menu.setApplicationMenu(null);
  return win;
}

setCreateWindowFunction(createWindow);

app.whenReady().then(async () => {
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

setConfigCallback(requestConfigFromRenderer);

module.exports = {
  createWindow,
  setConfigRequestHandler: setConfigCallback
};
