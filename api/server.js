const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { BrowserWindow } = require('electron');

const apiApp = express();
let server = null;
let currentProjectPath = null;
let getConfigCallback = null;
let triggerTaskStartCallback = null;
const sseClients = new Set();

const DEFAULT_CONFIG = {
  port: 2200,
  host: '127.0.0.1'
};

function createDefaultRuntimeState() {
  return {
    service: {
      status: 'service_connected',
      message: 'FutureDrive service online',
      startedAt: new Date().toISOString()
    },
    workflow: {
      status: 'idle',
      message: '工作流待启动',
      updatedAt: new Date().toISOString()
    },
    vehicle: {
      status: 'service_connected',
      message: '通讯已连接，等待工作流启动',
      updatedAt: new Date().toISOString(),
      telemetry: {
        speedKph: 0,
        steerDeg: 0,
        gear: 'UNKNOWN',
        vehicleStatus: 'UNKNOWN',
        telemetryUpdatedAt: ''
      }
    },
    task: {
      mode: '',
      modeLabel: '未选择任务',
      params: {},
      status: 'idle',
      message: '等待任务选择',
      updatedAt: new Date().toISOString()
    }
  };
}

let runtimeState = createDefaultRuntimeState();

function emitRuntimeState() {
  const payload = `data: ${JSON.stringify(runtimeState)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (error) {
      sseClients.delete(client);
    }
  }
}

function mergeRuntimeState(partialState = {}) {
  runtimeState = {
    ...runtimeState,
    ...partialState,
    service: {
      ...runtimeState.service,
      ...(partialState.service || {})
    },
    workflow: {
      ...runtimeState.workflow,
      ...(partialState.workflow || {})
    },
    vehicle: {
      ...runtimeState.vehicle,
      ...(partialState.vehicle || {}),
      telemetry: {
        ...runtimeState.vehicle.telemetry,
        ...((partialState.vehicle && partialState.vehicle.telemetry) || {})
      }
    },
    task: {
      ...(runtimeState.task || {}),
      ...(partialState.task || {})
    }
  };
  emitRuntimeState();
  return runtimeState;
}

function setRuntimeState(nextState) {
  runtimeState = nextState;
  emitRuntimeState();
  return runtimeState;
}

function getRuntimeState() {
  return runtimeState;
}

function setProjectPath(path) {
  currentProjectPath = path;
}

apiApp.use(cors());

apiApp.use(express.json());

apiApp.get('/api/hello', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Hello World!',
    timestamp: new Date().toISOString()
  });
});

apiApp.get('/api/runtime/state', (req, res) => {
  res.json({
    success: true,
    state: runtimeState
  });
});

apiApp.get('/api/runtime/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify(runtimeState)}\n\n`);
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

apiApp.post('/api/tasks/start', async (req, res) => {
  const mode = String(req.body?.mode || '').trim();
  const modeLabel = String(req.body?.modeLabel || '').trim() || '未命名任务';
  const params = req.body?.params && typeof req.body.params === 'object' ? req.body.params : {};

  if (!mode) {
    return res.status(400).json({
      success: false,
      error: '缺少任务模式'
    });
  }

  const updatedAt = new Date().toISOString();
  mergeRuntimeState({
    workflow: {
      status: 'workflow_starting',
      message: `已收到任务启动请求，准备执行${modeLabel}`,
      updatedAt
    },
    vehicle: {
      status: 'service_connected',
      message: `任务模式已切换为${modeLabel}，等待执行节点响应`,
      updatedAt
    },
    task: {
      mode,
      modeLabel,
      params,
      status: 'pending',
      message: `已确认开始${modeLabel}`,
      updatedAt
    }
  });

  if (typeof triggerTaskStartCallback === 'function') {
    try {
      const triggerResult = await triggerTaskStartCallback({
        mode,
        modeLabel,
        params
      });

      if (triggerResult?.success === false) {
        return res.status(500).json({
          success: false,
          error: triggerResult.error || '任务执行触发失败'
        });
      }
    } catch (error) {
      mergeRuntimeState({
        workflow: {
          status: 'error',
          message: `任务触发失败: ${error.message}`,
          updatedAt: new Date().toISOString()
        },
        vehicle: {
          status: 'error',
          message: '任务触发失败',
          updatedAt: new Date().toISOString()
        },
        task: {
          status: 'error',
          message: `任务触发失败: ${error.message}`,
          updatedAt: new Date().toISOString()
        }
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  res.json({
    success: true,
    state: runtimeState
  });
});

apiApp.get('/api/config', async (req, res) => {
  const key = req.query.key;
  if (!getConfigCallback) {
    return res.status(500).json({ success: false, error: '配置请求函数未初始化' });
  }
  try {
    const value = await getConfigCallback(key);
    res.json({ success: true, key, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiApp.get('/api/files', async (req, res) => {
  try {
    if (!currentProjectPath) {
      return res.json({ 
        success: true, 
        files: [],
        message: '项目未打开'
      });
    }

    if (req.query.path) {
      const filePath = path.join(currentProjectPath, req.query.path);
      
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(currentProjectPath)) {
        return res.status(403).json({ 
          success: false, 
          error: '无权访问项目目录外的文件' 
        });
      }

      const content = await fs.readFile(filePath, 'utf8');
      if (path.extname(filePath).toLowerCase() === '.json') {
        try {
          const jsonContent = JSON.parse(content);
          return res.json({ 
            success: true, 
            content: JSON.stringify(jsonContent),
            path: req.query.path
          });
        } catch (e) {
          return res.json({
            success: true, 
            content,
            path: req.query.path
          });
        }
      }
      
      return res.json({
        success: true, 
        content,
        path: req.query.path
      });
    }

    const files = await fs.readdir(currentProjectPath);
    res.json({
      success: true, 
      files,
      root: currentProjectPath
    });
  } catch (error) {
    res.status(500).json({
      success: false, 
      error: error.message 
    });
  }
});

async function getServerConfig() {
  try {
    const config = global.serverConfig;
    return {
      port: config?.port || DEFAULT_CONFIG.port,
      host: config?.host || DEFAULT_CONFIG.host
    };
  } catch (error) {
    console.error('获取服务器配置失败:', error);
    return DEFAULT_CONFIG;
  }
}

async function startServer() {
  try {
    if (server) {
      console.log('服务器已经在运行中');
      return server;
    }

    const config = await getServerConfig();
    setRuntimeState(createDefaultRuntimeState());
    return new Promise((resolve, reject) => {
      server = apiApp.listen(config.port, config.host, () => {
        console.log(`API 服务器运行在 http://${config.host}:${config.port}`);
        resolve(server);
      });

      server.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    throw error;
  }
}

async function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server) {
      console.log('服务器未运行');
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        console.error('停止服务器失败:', error);
        reject(error);
        return;
      }
      for (const client of sseClients) {
        try {
          client.end();
        } catch (endError) {
        }
      }
      sseClients.clear();
      server = null;
      resolve();
    });
  });
}

async function restartServer() {
  try {
    await stopServer();
    await startServer();
  } catch (error) {
    console.error('重启服务器失败:', error);
    throw error;
  }
}

function setConfigCallback(fn) {
  getConfigCallback = fn;
}

function setTaskStartCallback(fn) {
  triggerTaskStartCallback = fn;
}

module.exports = {
  startServer,
  stopServer,
  restartServer,
  setProjectPath,
  setConfigCallback,
  setTaskStartCallback,
  mergeRuntimeState,
  setRuntimeState,
  getRuntimeState
};
