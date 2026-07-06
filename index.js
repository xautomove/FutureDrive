const { app, BrowserWindow, Menu, screen, globalShortcut } = require('electron/main')
const path = require('path')
const fs = require('fs')
const { startServer, setConfigCallback, setTaskStartCallback, setTaskStopCallback, setActuatorStateCallback, mergeRuntimeState } = require('./api/server');
const { setWindowParams, setCreateWindowFunction } = require('./ipc/handlers');
require('@electron/remote/main').initialize()

let mainWindow = null;
let appShuttingDown = false;
let startHidden = false;
let postWindowInitStarted = false;
const TOGGLE_WINDOW_SHORTCUT = 'CommandOrControl+Shift+F11';
let shutdownCleanupStarted = false;
const AUTOSTART_LAUNCH_ARG = '--autostart-launch';
const launchContext = {
  isAutostartLaunch: process.argv.includes(AUTOSTART_LAUNCH_ARG),
  shouldStartHidden: false
};

function logMainProcessError(context, error, extra = {}) {
  if (error instanceof Error) {
    console.error(`[MainProcess] ${context}:`, {
      message: error.message,
      stack: error.stack,
      ...extra
    });
    return;
  }

  console.error(`[MainProcess] ${context}:`, {
    error,
    ...extra
  });
}

function getAutostartHelper() {
  return require('./system/ubuntuAutostart.js');
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

function resolveWindowLaunchContext() {
  const mainConfig = readMainProcessConfig();
  const otherConfig = mainConfig.other || {};

  launchContext.shouldStartHidden = launchContext.isAutostartLaunch && Boolean(otherConfig?.noUi);

  return {
    ...launchContext
  };
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
  setWindowParams(winid, {
    page,
    params,
    launchContext: isMainWindow ? resolveWindowLaunchContext() : undefined
  });

  const windowTag = page || 'main';
  
  win.webContents.executeJavaScript(`
    localStorage.setItem('windowId', '${winid}');
  `);

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('[WindowLoad] 页面加载失败:', {
      windowId: winid,
      page: windowTag,
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    });
  });

  win.webContents.on('render-process-gone', (event, details) => {
    console.error('[WindowRender] 渲染进程退出:', {
      windowId: winid,
      page: windowTag,
      reason: details?.reason,
      exitCode: details?.exitCode
    });
  });

  win.webContents.on('console-message', (details) => {
    const { level, message, lineNumber, sourceId } = details;
    if (level === 'info' || level === 'debug') {
      return;
    }

    const levelLabel = level === 'error' ? 'error' : 'warn';
    console[levelLabel]('[RendererConsole] 渲染进程日志:', {
      windowId: winid,
      page: windowTag,
      level: levelLabel,
      message,
      line: lineNumber,
      sourceId
    });
  });
  
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

  win.on('unresponsive', () => {
    console.warn('[WindowState] 窗口无响应:', {
      windowId: winid,
      page: windowTag
    });
  });

  win.on('responsive', () => {
    console.log('[WindowState] 窗口已恢复响应:', {
      windowId: winid,
      page: windowTag
    });
  });

  // 保留手动调试入口，白屏排查时可以直接按 F12 打开开发者工具。
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

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
  const registered = globalShortcut.register(TOGGLE_WINDOW_SHORTCUT, () => {
    toggleMainWindowVisibility();
  });

  if (!registered) {
    console.warn(`${TOGGLE_WINDOW_SHORTCUT} 快捷键注册失败`);
  }
}

async function resolveStartupState() {
  const mainConfig = readMainProcessConfig();
  const startupConfig = mainConfig.startup || {};
  const currentLaunchContext = resolveWindowLaunchContext();
  return {
    startupConfig,
    shouldStartHidden: currentLaunchContext.shouldStartHidden
  };
}

function schedulePostWindowInitialization() {
  if (postWindowInitStarted) {
    return;
  }
  postWindowInitStarted = true;

  setTimeout(async () => {
    try {
      // Linux AppImage on Ubuntu 22.04 is sensitive to early main-process work.
      // Keep startup-only integrations deferred until the first window is loaded.
      const startupState = await resolveStartupState();
      startHidden = startupState.shouldStartHidden;

      registerGlobalShortcuts();

      if (startHidden && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }

    } catch (error) {
      console.warn('后置初始化失败:', error.message);
    }
  }, 1500);
}

async function cleanupBeforeQuit() {
  if (shutdownCleanupStarted) {
    return;
  }
  shutdownCleanupStarted = true;

  try {
    const cleanupResult = await triggerWorkflowShutdownFromRenderer();
    if (cleanupResult?.success === false) {
      console.warn('退出前清理后台节点失败:', cleanupResult.error || 'unknown error');
    }
  } catch (error) {
    console.warn('退出前清理后台节点失败:', error.message);
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

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (startHidden) {
      return;
    }
    appShuttingDown = true;
    await cleanupBeforeQuit();
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  if (!shutdownCleanupStarted) {
    event.preventDefault();
    appShuttingDown = true;
    await cleanupBeforeQuit();
    app.quit();
    return;
  }
  appShuttingDown = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

process.on('uncaughtException', (error) => {
  logMainProcessError('未捕获异常', error);
});

process.on('unhandledRejection', (reason) => {
  logMainProcessError('未处理 Promise 拒绝', reason);
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

function triggerActuatorStateFromRenderer(actuatorPayload) {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return resolve({ success: false, error: '主窗口未初始化' });
    }

    const { ipcMain } = require('electron');
    ipcMain.once('set-actuator-state-reply', (event, result) => {
      resolve(result || { success: false, error: '执行单元状态同步结果为空' });
    });
    mainWindow.webContents.send('set-actuator-state', actuatorPayload);
  });
}

function triggerWorkflowShutdownFromRenderer() {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return resolve({ success: true });
    }

    const { ipcMain } = require('electron');
    const timeout = setTimeout(() => {
      resolve({ success: false, error: '退出清理超时' });
    }, 5000);
    ipcMain.once('shutdown-workflow-reply', (event, result) => {
      clearTimeout(timeout);
      resolve(result || { success: false, error: '退出清理结果为空' });
    });
    mainWindow.webContents.send('shutdown-workflow');
  });
}

function triggerTaskStopFromRenderer(taskPayload) {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return resolve({ success: false, error: '主窗口未初始化' });
    }

    const { ipcMain } = require('electron');
    ipcMain.once('stop-task-reply', (event, result) => {
      resolve(result || { success: false, error: '任务停止结果为空' });
    });
    mainWindow.webContents.send('stop-task', taskPayload);
  });
}

setConfigCallback(requestConfigFromRenderer);
setTaskStartCallback(triggerTaskStartFromRenderer);
setTaskStopCallback(triggerTaskStopFromRenderer);
setActuatorStateCallback(triggerActuatorStateFromRenderer);

module.exports = {
  createWindow,
  setConfigRequestHandler: setConfigCallback,
  syncUbuntuAutostart: (enabled) => {
    if (process.platform !== 'linux') {
      return Promise.resolve({ success: true, skipped: true, reason: 'not_linux' });
    }
    const startupConfig = readMainProcessConfig().startup || {};
    const execPath = startupConfig.ui?.executablePath || process.execPath;
    return getAutostartHelper().syncUbuntuAutostart(enabled, execPath);
  }
};
