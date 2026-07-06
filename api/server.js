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
let triggerTaskStopCallback = null;
let triggerActuatorStateCallback = null;
const sseClients = new Set();

const DEFAULT_CONFIG = {
  port: 2200,
  host: '127.0.0.1'
};

const DEFAULT_ACTUATOR_STATE = {
  frontLaser: false,
  rearLaser: false,
  warningLight: false,
  hotMelt: false,
  electricParking: false
};

function resolveTaskType(mode = '') {
  const normalizedMode = String(mode || '').trim();
  if (['plane_marking', 'vibration_marking', 'short_line_marking'].includes(normalizedMode)) {
    return 'line';
  }
  if (['visual_tracking', 'auto_start'].includes(normalizedMode)) {
    return 'see';
  }
  return '';
}

function normalizeActuatorState(partialState = {}, fallbackState = DEFAULT_ACTUATOR_STATE) {
  const source = partialState && typeof partialState === 'object'
    ? (partialState.actuators && typeof partialState.actuators === 'object' ? partialState.actuators : partialState)
    : {};

  return {
    frontLaser: source.frontLaser ?? fallbackState.frontLaser,
    rearLaser: source.rearLaser ?? fallbackState.rearLaser,
    warningLight: source.warningLight ?? fallbackState.warningLight,
    hotMelt: source.hotMelt ?? fallbackState.hotMelt,
    electricParking: source.electricParking ?? fallbackState.electricParking
  };
}

function createDefaultRuntimeState() {
  return {
    service: {
      status: 'service_connected',
      message: 'FutureDrive service online',
      startedAt: new Date().toISOString()
    },
    workflow: {
      status: 'idle',
      message: '等待任务中',
      updatedAt: new Date().toISOString()
    },
    vehicle: {
      status: 'service_connected',
      message: '通讯已连接，等待任务中',
      updatedAt: new Date().toISOString(),
      actuators: {
        ...DEFAULT_ACTUATOR_STATE
      },
      telemetry: {
        speedKph: 0,
        steerDeg: 0,
        travelDistanceM: null,
        gear: 'UNKNOWN',
        vehicleStatus: 'UNKNOWN',
        telemetryUpdatedAt: '',
        bucketTemperatureC: null,
        bucketTemperatureUpdatedAt: ''
      }
    },
    task: {
      mode: '',
      type: '',
      state: 'stop',
      modeLabel: '未选择任务',
      params: {},
      startedAt: '',
      resetToken: '',
      status: 'idle',
      message: '等待任务中',
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
  const taskType = String(req.body?.taskType || resolveTaskType(mode)).trim();

  if (!mode) {
    return res.status(400).json({
      success: false,
      error: '缺少任务模式'
    });
  }

  const updatedAt = new Date().toISOString();
  const resetToken = String(req.body?.resetToken || updatedAt);
  mergeRuntimeState({
    workflow: {
      status: 'completed',
      message: '任务执行中',
      updatedAt
    },
    vehicle: {
      status: 'vehicle_ready',
      message: `${modeLabel}任务执行中`,
      updatedAt,
      telemetry: {
        travelDistanceM: 0,
        telemetryUpdatedAt: updatedAt
      }
    },
    task: {
      mode,
      type: taskType,
      state: 'start',
      modeLabel,
      params,
      startedAt: updatedAt,
      resetToken,
      status: 'pending',
      message: '任务执行中',
      updatedAt
    }
  });

  if (typeof triggerTaskStartCallback === 'function') {
    try {
      const triggerResult = await triggerTaskStartCallback({
        mode,
        taskType,
        modeLabel,
        params,
        startedAt: updatedAt,
        resetToken
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

apiApp.post('/api/tasks/stop', async (req, res) => {
  const currentTask = runtimeState.task || {};
  const mode = '';
  const modeLabel = '未选择任务';
  const params = {};
  const taskType = '';
  const updatedAt = new Date().toISOString();

  if (typeof triggerTaskStopCallback === 'function') {
    try {
      const triggerResult = await triggerTaskStopCallback({
        mode,
        taskType,
        modeLabel,
        params,
        stoppedAt: updatedAt
      });

      if (triggerResult?.success === false) {
        return res.status(500).json({
          success: false,
          error: triggerResult.error || '任务停止触发失败'
        });
      }
    } catch (error) {
      mergeRuntimeState({
        workflow: {
          status: 'error',
          message: `任务停止失败: ${error.message}`,
          updatedAt
        },
        vehicle: {
          status: 'error',
          message: '任务停止失败',
          updatedAt
        },
        task: {
          status: 'error',
          message: `任务停止失败: ${error.message}`,
          updatedAt
        }
      });

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  mergeRuntimeState({
    workflow: {
      status: 'stopped',
      message: '任务已停止',
      updatedAt
    },
    vehicle: {
      status: 'service_connected',
      message: '通讯已连接，等待任务中',
      updatedAt
    },
    task: {
      mode,
      type: taskType,
      state: 'stop',
      modeLabel,
      params,
      status: 'stopped',
      message: '任务已停止',
      updatedAt
    }
  });

  res.json({
    success: true,
    state: runtimeState
  });
});

apiApp.post('/api/actuators/state', async (req, res) => {
  const currentActuators = normalizeActuatorState(runtimeState.vehicle?.actuators, DEFAULT_ACTUATOR_STATE);
  const nextActuators = normalizeActuatorState(req.body, currentActuators);
  const updatedAt = new Date().toISOString();

  if (typeof triggerActuatorStateCallback === 'function') {
    try {
      const triggerResult = await triggerActuatorStateCallback({
        actuators: nextActuators,
        updatedAt
      });

      if (triggerResult?.success === false) {
        return res.status(500).json({
          success: false,
          error: triggerResult.error || '执行单元状态同步失败'
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  mergeRuntimeState({
    vehicle: {
      actuators: nextActuators,
      updatedAt
    }
  });

  res.json({
    success: true,
    actuators: nextActuators,
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

function setTaskStopCallback(fn) {
  triggerTaskStopCallback = fn;
}

function setActuatorStateCallback(fn) {
  triggerActuatorStateCallback = fn;
}

module.exports = {
  startServer,
  stopServer,
  restartServer,
  setProjectPath,
  setConfigCallback,
  setTaskStartCallback,
  setTaskStopCallback,
  setActuatorStateCallback,
  mergeRuntimeState,
  setRuntimeState,
  getRuntimeState
};
