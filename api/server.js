const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { BrowserWindow } = require('electron');

const apiApp = express();
let server = null;
let currentProjectPath = null;
let getConfigCallback = null;

const DEFAULT_CONFIG = {
  port: 2200,
  host: 'localhost'
};

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
      console.log("filePath", filePath);
      
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

module.exports = {
  startServer,
  stopServer,
  restartServer,
  setProjectPath,
  setConfigCallback
}; 