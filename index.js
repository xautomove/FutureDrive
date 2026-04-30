const { app, BrowserWindow, Menu, screen, globalShortcut } = require('electron/main')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process');
const { startServer, setConfigCallback, setTaskStartCallback, mergeRuntimeState } = require('./api/server');
const { setWindowParams, setCreateWindowFunction } = require('./ipc/handlers');
require('@electron/remote/main').initialize()

let mainWindow = null;
let uiProcess = null;
let appShuttingDown = false;
let startHidden = false;
let postWindowInitStarted = false;

function getAutostartHelper() {
  return require('./system/ubuntuAutostart');
}

function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'FutureDrive', 'config', 'config.json');
}

function readMainProcessConfig() {
  try {
    const configPath = getConfigFilePath();
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('读取主进程配置失败:', error.message);
    return {};
  }
}

const createWindow = (width, height, page = '', params = []) => {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = width || Math.floor(screenWidth * 0.8);
  const winHeight = height || Math.floor(screenHeight * 0.8);
  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
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

  const isMainWindow = mainWindow == null && page == "";
  if (isMainWindow) {
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

    if (isMainWindow) {
      schedulePostWindowInitialization();
    }
  });

  win.on('close', (event) => {
    if (isMainWindow && startHidden && !appShuttingDown) {
      event.preventDefault();
      win.hide();
    }
  });

  // win.webContents.on('before-input-event', (event, input) => {
  //   if (input.key === 'F12') {
  //     win.webContents.toggleDevTools();
  //     event.preventDefault();
  //   }
  // });

  Menu.setApplicationMenu(null);
  return win;
}

async function getConfigValue(key, fallback = null) {
  try {
    const value = await requestConfigFromRenderer(key);
    return value === undefined || value === null || value === '' ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function toggleMainWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function registerGlobalShortcuts() {
  const registered = globalShortcut.register('CommandOrControl+F11', () => {
    toggleMainWindowVisibility();
  });

  if (!registered) {
    console.warn('Ctrl+F11 快捷键注册失败');
  }
}

async function resolveStartupState() {
  const mainConfig = readMainProcessConfig();
  const startupConfig = mainConfig.startup || {};
  const otherConfig = mainConfig.other || {};
  return {
    startupConfig,
    otherConfig,
    shouldStartHidden: Boolean(otherConfig?.noUi)
  };
}

function schedulePostWindowInitialization() {
  if (postWindowInitStarted) {
    return;
  }
  postWindowInitStarted = true;

  setTimeout(async () => {
    try {
      const startupState = await resolveStartupState();
      startHidden = startupState.shouldStartHidden;

      registerGlobalShortcuts();

      if (startHidden && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }

      await launchUiIfEnabled();
    } catch (error) {
      console.warn('后置初始化失败:', error.message);
    }
  }, 1500);
}

async function launchUiIfEnabled() {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  if (uiProcess && !uiProcess.killed) {
    return;
  }

  const startupConfig = await getConfigValue('startup', {});
  const uiConfig = startupConfig?.ui || startupConfig?.carUi || {};
  if (!uiConfig.enabled) {
    return;
  }

  const executablePath = String(uiConfig.executablePath || '').trim();
  if (!executablePath) {
    mergeRuntimeState({
      workflow: {
        status: 'error',
        message: 'UI 可执行文件路径未配置',
        updatedAt: new Date().toISOString()
      },
      vehicle: {
        status: 'error',
        message: 'UI 可执行文件路径未配置',
        updatedAt: new Date().toISOString()
      }
    });
    return;
  }

  try {
    uiProcess = spawn(executablePath, [], {
      detached: true,
      stdio: 'ignore',
      shell: false
    });

    mergeRuntimeState({
      service: {
        status: 'service_connected',
        message: 'FutureDrive service online, UI launched',
        updatedAt: new Date().toISOString()
      }
    });

    uiProcess.on('error', (error) => {
      mergeRuntimeState({
        workflow: {
          status: 'error',
          message: `UI 启动失败: ${error.message}`,
          updatedAt: new Date().toISOString()
        },
        vehicle: {
          status: 'error',
          message: 'UI 启动失败',
          updatedAt: new Date().toISOString()
        }
      });
    });

    uiProcess.on('exit', (code) => {
      if (!appShuttingDown && code && code !== 0) {
        mergeRuntimeState({
          workflow: {
            status: 'error',
            message: `UI 异常退出: ${code}`,
            updatedAt: new Date().toISOString()
          },
          vehicle: {
            status: 'error',
            message: 'UI 异常退出',
            updatedAt: new Date().toISOString()
          }
        });
      } else if (!appShuttingDown) {
        mergeRuntimeState({
          service: {
            status: 'service_connected',
            message: 'FutureDrive service online, UI closed',
            updatedAt: new Date().toISOString()
          }
        });
      }
      uiProcess = null;
    });

    uiProcess.unref();
  } catch (error) {
    console.error('启动 UI 失败:', error);
    mergeRuntimeState({
      workflow: {
        status: 'error',
        message: `UI 启动失败: ${error.message}`,
        updatedAt: new Date().toISOString()
      },
      vehicle: {
        status: 'error',
        message: 'UI 启动失败',
        updatedAt: new Date().toISOString()
      }
    });
  }
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
    } else if (mainWindow && !mainWindow.isVisible()) {
      toggleMainWindowVisibility();
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (startHidden) {
      return;
    }
    appShuttingDown = true;
    app.quit()
  }
})

app.on('before-quit', () => {
  appShuttingDown = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

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

function triggerTaskStartFromRenderer(taskPayload) {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return resolve({ success: false, error: '主窗口未初始化' });
    }

    const { ipcMain } = require('electron');
    ipcMain.once('start-task-reply', (event, result) => {
      resolve(result || { success: false, error: '任务执行结果为空' });
    });
    mainWindow.webContents.send('start-task', taskPayload);
  });
}

setConfigCallback(requestConfigFromRenderer);
setTaskStartCallback(triggerTaskStartFromRenderer);

module.exports = {
  createWindow,
  setConfigRequestHandler: setConfigCallback,
  syncUbuntuAutostart: (enabled) => getAutostartHelper().syncUbuntuAutostart(enabled, process.execPath)
};
