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
import RosBagPlayer from './components/RosBagPlayer/RosBagPlayer';
import { message } from 'antd';
const { ipcRenderer } = window.require('electron');
import config from './assets/js/config'
import { ReactFlowProvider } from 'reactflow';
import RedisController from './controller/node/RedisController';
import GLOBALS from './assets/js/globals';
import { puts } from './assets/js/cloud';
import { runWorkflowFromAutoStart } from './assets/js/workflowRunner';

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
      
      (async () => {
        const lastSysInfoDate = await config.get('lastSysInfoDate');
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0');
        if (!lastSysInfoDate || lastSysInfoDate !== todayStr) {
          ipcRenderer.invoke('get-sys-info').then(info => {
            puts('1', '启动程序', JSON.stringify(info));
            config.set('lastSysInfoDate', todayStr);
            config.set('systemInfo', info.os.release);
          });
        }
      })();
    }

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
        } else if (page === 'ros_bag_player') {
          setComponent(<RosBagPlayer visible={true} onClose={() => window.close()} />);
        } else {
          setComponent(<Layout />);
        }

        if (window.isMainWindow) {
          ipcRenderer.removeAllListeners('get-config');
          ipcRenderer.on('get-config', (event, key) => {
            const value = config.get(key);
            event.sender.send('get-config-reply', value);
          });

          ipcRenderer.removeAllListeners('start-task');
          ipcRenderer.on('start-task', async (event, payload) => {
            try {
              GLOBALS.currentTaskContext = {
                mode: payload?.mode || '',
                modeLabel: payload?.modeLabel || '未命名任务',
                startedAt: new Date().toISOString()
              };

              await GLOBALS.updateRuntimeState({
                task: {
                  mode: payload?.mode || '',
                  modeLabel: payload?.modeLabel || '未命名任务',
                  status: 'starting',
                  message: `FutureDrive 正在启动${payload?.modeLabel || '任务'}`,
                  updatedAt: new Date().toISOString()
                }
              });

              await runWorkflowFromAutoStart();

              event.sender.send('start-task-reply', {
                success: true
              });
            } catch (error) {
              await GLOBALS.updateRuntimeState({
                task: {
                  mode: payload?.mode || '',
                  modeLabel: payload?.modeLabel || '未命名任务',
                  status: 'error',
                  message: `任务启动失败: ${error.message}`,
                  updatedAt: new Date().toISOString()
                }
              });

              event.sender.send('start-task-reply', {
                success: false,
                error: error.message
              });
            }
          });

          GLOBALS.updateRuntimeState = async (partialState) => {
            try {
              return await ipcRenderer.invoke('update-runtime-state', partialState);
            } catch (error) {
              console.error('更新运行状态失败:', error);
              return { success: false, error: error.message };
            }
          };

          GLOBALS.syncUbuntuAutostart = async (enabled) => {
            try {
              return await ipcRenderer.invoke('sync-ubuntu-autostart', enabled);
            } catch (error) {
              console.error('同步 Ubuntu 自启动失败:', error);
              return { success: false, error: error.message };
            }
          };

          try {
            const serverConfig = config.get('api') || {
              port: 2200,
              host: '127.0.0.1'
            };
            
            await ipcRenderer.invoke('start-server', serverConfig);
            await GLOBALS.updateRuntimeState({
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
                updatedAt: new Date().toISOString()
              }
            });
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
                await GLOBALS.updateRuntimeState({
                  service: {
                    status: 'service_connected',
                    message: 'FutureDrive service online, Redis connected',
                    updatedAt: new Date().toISOString()
                  }
                });
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
