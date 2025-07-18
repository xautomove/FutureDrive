import React, { useEffect, useState, useRef } from 'react';

// 禁用React DevTools下载提示
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  isDisabled: true,
  supportsFiber: true,
  inject: () => {},
  onCommitFiberRoot: () => {},
  onCommitFiberUnmount: () => {}
};

import Layout from './components/Layout/Layout';
import TopicEchoViewer from './components/TopicEchoViewer/TopicEchoViewer';
import MapEditor from './components/MapEditor/MapEditor';
import { message } from 'antd';
const { ipcRenderer } = window.require('electron');
import config from './assets/js/config'
import { ReactFlowProvider } from 'reactflow';
import RedisController from './controller/node/RedisController';
import GLOBALS from './assets/js/globals';

async function getSystemInfo() {
  const cachedInfo = config.get('systemInfo');
  if (cachedInfo && cachedInfo.platform) {
    window.systemInfo = cachedInfo;
    return;
  }

  const platform = process.platform;
  let version = 'unknown';
  
  try {
    if (platform === 'linux') {
      const { execSync } = window.require('child_process');
      const osRelease = execSync('cat /etc/os-release', { encoding: 'utf-8' });
      const versionMatch = osRelease.match(/VERSION_ID="([^"]+)"/);
      version = versionMatch ? versionMatch[1] : 'unknown';
    } else if (platform === 'win32') {
      const { exec } = window.require('child_process');
      
      try {
        version = process.getSystemVersion?.() || 'unknown';
      } catch (e) {
        console.log('使用process.getSystemVersion失败:', e);
      }
      
      if (version === 'unknown') {
        try {
          version = await new Promise((resolve) => {
            const cmd = 'wmic os get caption,version /value';
            exec(cmd, { encoding: 'utf-8' }, (error, stdout) => {
              if (error) {
                console.error('获取Windows版本失败:', error);
                resolve('unknown');
                return;
              }
              
              const matches = stdout.match(/Version=([\d.]+)/);
              resolve(matches ? matches[1] : 'unknown');
            });
            
            setTimeout(() => {
              resolve('unknown');
            }, 5000);
          });
        } catch (e) {
            console.error('异步获取Windows版本失败:', e);
        }
      }
    }
  } catch (error) {
    console.error('获取系统信息失败:', error);
  }

  const systemInfo = {
    platform,
    version,
    isUbuntu: platform === 'linux',
    isWindows: platform === 'win32'
  };

  window.systemInfo = systemInfo;
  await config.set('systemInfo', systemInfo);
}

function App() {
  const [Component, setComponent] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!window.__versionChecked) {
      window.__versionChecked = true;
      
      const checkAppVersion = async () => {
        try {
          await config.checkVersion();
        } catch (error) {
          console.error('版本检查失败:', error);
        }
      };
      // checkAppVersion();
      // ipcRenderer.invoke('get-sys-info').then(info => {
      //   console.log(info);
      // });
    }

    // getSystemInfo();
    
    if (initialized.current) return;
    initialized.current = true;

    const loadWindowParams = async () => {
      try {
        const { page, params } = await ipcRenderer.invoke('get-window-params');

        window.isMainWindow = page == "" ? 1 : 0;

        if (page === 'show_topic') {
          const topic = params['topic'];
          setComponent(<TopicEchoViewer topic={topic} />);
        } else if (page === 'map_editor') {
          setComponent(<MapEditor />);
        } else {
          setComponent(<Layout />);
        }

        if (window.isMainWindow) {
          ipcRenderer.removeAllListeners('get-config');
          ipcRenderer.on('get-config', (event, key) => {
            const value = config.get(key);
            event.sender.send('get-config-reply', value);
          });

          try {
            const serverConfig = config.get('server') || {
              port: 2200,
              host: 'localhost'
            };
            
            await ipcRenderer.invoke('start-server', serverConfig);
            console.log('服务器启动成功');
          } catch (error) {
            console.error('启动服务器失败:', error);
            message.error('启动服务器失败');
          }

          // 初始化 Redis 连接
          try {
            const redisConfig = config.get('redis') || {
              host: 'localhost',
              port: 6379,
              password: null,
              db: 0,
              enabled: false
            };

            if (redisConfig.enabled) {
              console.log('正在连接 Redis...');
              const redisController = new RedisController();
              const connected = await redisController.initialize({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db
              });

              if (connected) {
                GLOBALS.redisController = redisController;
                console.log('Redis 连接成功');
                message.success('Redis 连接成功');
              } else {
                console.error('Redis 连接失败');
                message.warning('Redis 连接失败，将使用默认缓存');
              }
            } else {
              console.log('Redis 未启用，跳过连接');
            }
          } catch (error) {
            console.error('Redis 初始化失败:', error);
            message.warning('Redis 初始化失败，将使用默认缓存');
          }
        }
      } catch (error) {
        console.error("获取窗口参数失败:", error);
        setComponent(<Layout />);
      }
    };

    loadWindowParams();

    return () => {
      if (window.isMainWindow) {
        ipcRenderer.invoke('stop-server').catch(error => {
          console.error('停止服务器失败:', error);
        });
      }
    };
  }, []); 

  if (!Component) return null;

  return (
    <div className="App">
      <ReactFlowProvider>
        {Component}
      </ReactFlowProvider>
    </div>
  );
}

export default App; 