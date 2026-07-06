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

const DEFAULT_MANUAL_ACTUATORS = {
  frontLaser: false,
  rearLaser: false,
  warningLight: false,
  hotMelt: false,
  electricParking: false
};

function normalizeManualActuatorState(partialState = {}, fallbackState = DEFAULT_MANUAL_ACTUATORS) {
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
        GLOBALS.manualActuatorState = normalizeManualActuatorState(GLOBALS.manualActuatorState);

        const syncFutureConfigActuators = async (actuatorPayload) => {
          const nextActuators = normalizeManualActuatorState(actuatorPayload, GLOBALS.manualActuatorState || DEFAULT_MANUAL_ACTUATORS);
          GLOBALS.manualActuatorState = nextActuators;

          if (!GLOBALS.redisController || !GLOBALS.redisController.isConnected()) {
            return nextActuators;
          }

          const currentFutureConfig = await GLOBALS.redisController.get('future_config');
          const mergedFutureConfig = currentFutureConfig && typeof currentFutureConfig === 'object'
            ? { ...currentFutureConfig }
            : {};

          mergedFutureConfig.manualActuators = nextActuators;

          if (!mergedFutureConfig.taskMode && GLOBALS.currentTaskContext?.mode) {
            mergedFutureConfig.taskMode = GLOBALS.currentTaskContext.mode;
            mergedFutureConfig.taskModeLabel = GLOBALS.currentTaskContext.modeLabel || '';
            mergedFutureConfig.taskParams = GLOBALS.currentTaskContext.params || {};
            mergedFutureConfig.taskStartedAt = GLOBALS.currentTaskContext.startedAt || '';
          }

          await GLOBALS.redisController.set('future_config', mergedFutureConfig);
          return nextActuators;
        };

        const syncFutureConfigRuntime = async (partialState = {}) => {
          if (!GLOBALS.redisController || !GLOBALS.redisController.isConnected()) {
            return;
          }

          const currentFutureConfig = await GLOBALS.redisController.get('future_config');
          const mergedFutureConfig = currentFutureConfig && typeof currentFutureConfig === 'object'
            ? { ...currentFutureConfig }
            : {};

          if (partialState.workflow && typeof partialState.workflow === 'object') {
            mergedFutureConfig.workflowStatus = partialState.workflow.status ?? mergedFutureConfig.workflowStatus ?? 'idle';
            mergedFutureConfig.workflowMessage = partialState.workflow.message ?? mergedFutureConfig.workflowMessage ?? '';
            mergedFutureConfig.workflowUpdatedAt = partialState.workflow.updatedAt ?? mergedFutureConfig.workflowUpdatedAt ?? '';
          }

          if (partialState.task && typeof partialState.task === 'object') {
            mergedFutureConfig.taskStatus = partialState.task.status ?? mergedFutureConfig.taskStatus ?? 'idle';
            mergedFutureConfig.taskMessage = partialState.task.message ?? mergedFutureConfig.taskMessage ?? '';
            mergedFutureConfig.taskUpdatedAt = partialState.task.updatedAt ?? mergedFutureConfig.taskUpdatedAt ?? '';
            if (partialState.task.type !== undefined) {
              mergedFutureConfig.taskType = partialState.task.type || '';
            }
            if (partialState.task.state !== undefined) {
              mergedFutureConfig.taskState = partialState.task.state || 'stop';
            }
            if (partialState.task.mode !== undefined) {
              mergedFutureConfig.taskMode = partialState.task.mode || '';
            }
            if (partialState.task.modeLabel !== undefined) {
              mergedFutureConfig.taskModeLabel = partialState.task.modeLabel || '';
            }
            if (partialState.task.params && typeof partialState.task.params === 'object') {
              mergedFutureConfig.taskParams = partialState.task.params;
            }
            if (partialState.task.startedAt !== undefined) {
              mergedFutureConfig.taskStartedAt = partialState.task.startedAt || '';
            }
            if (partialState.task.resetToken !== undefined) {
              mergedFutureConfig.taskResetToken = partialState.task.resetToken || '';
            }
          }

          if (partialState.vehicle?.actuators) {
            mergedFutureConfig.manualActuators = normalizeManualActuatorState(
              partialState.vehicle.actuators,
              mergedFutureConfig.manualActuators || GLOBALS.manualActuatorState || DEFAULT_MANUAL_ACTUATORS
            );
          }

          await GLOBALS.redisController.set('future_config', mergedFutureConfig);
        };

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
              const updatedAt = new Date().toISOString();
              const taskType = payload?.taskType || resolveTaskType(payload?.mode || '');
              const resetToken = payload?.resetToken || updatedAt;
              GLOBALS.currentTaskContext = {
                mode: payload?.mode || '',
                type: taskType,
                state: 'start',
                modeLabel: payload?.modeLabel || '未命名任务',
                params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
                startedAt: updatedAt,
                resetToken
              };

              await GLOBALS.updateRuntimeState({
                workflow: {
                  status: 'completed',
                  message: `已切换到${payload?.modeLabel || '任务'}，等待常驻节点响应`,
                  updatedAt
                },
                task: {
                  mode: payload?.mode || '',
                  type: taskType,
                  state: 'start',
                  modeLabel: payload?.modeLabel || '未命名任务',
                  params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
                  startedAt: updatedAt,
                  resetToken,
                  status: 'pending',
                  message: `FutureDrive 已下发${payload?.modeLabel || '任务'}控制信号`,
                  updatedAt
                },
                vehicle: {
                  status: 'vehicle_ready',
                  message: `任务模式已切换为${payload?.modeLabel || '任务'}，常驻节点执行中`,
                  updatedAt,
                  telemetry: {
                    travelDistanceM: 0,
                    telemetryUpdatedAt: updatedAt
                  }
                }
              });

              event.sender.send('start-task-reply', {
                success: true
              });
            } catch (error) {
              await GLOBALS.updateRuntimeState({
                task: {
                  mode: payload?.mode || '',
                  modeLabel: payload?.modeLabel || '未命名任务',
                  params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
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

          ipcRenderer.removeAllListeners('stop-task');
          ipcRenderer.on('stop-task', async (event, payload) => {
            try {
              const updatedAt = new Date().toISOString();
              const activeContext = GLOBALS.currentTaskContext || {};
              const mode = payload?.mode || activeContext.mode || '';
              const modeLabel = payload?.modeLabel || activeContext.modeLabel || '未选择任务';
              const params = payload?.params && typeof payload.params === 'object'
                ? payload.params
                : (activeContext.params && typeof activeContext.params === 'object' ? activeContext.params : {});
              const taskType = payload?.taskType || activeContext.type || resolveTaskType(mode);

              GLOBALS.currentTaskContext = {
                ...activeContext,
                mode,
                type: taskType,
                state: 'stop',
                modeLabel,
                params,
                stoppedAt: updatedAt
              };

              await GLOBALS.updateRuntimeState({
                workflow: {
                  status: 'stopped',
                  message: mode ? `${modeLabel}已停止` : '任务已停止',
                  updatedAt
                },
                task: {
                  mode,
                  type: taskType,
                  state: 'stop',
                  modeLabel,
                  params,
                  status: 'stopped',
                  message: mode ? `${modeLabel}已停止` : '任务已停止',
                  updatedAt
                },
                vehicle: {
                  status: 'service_connected',
                  message: '任务已停止，常驻节点待命中',
                  updatedAt
                }
              });

              event.sender.send('stop-task-reply', {
                success: true
              });
            } catch (error) {
              await GLOBALS.updateRuntimeState({
                workflow: {
                  status: 'error',
                  message: `任务停止失败: ${error.message}`,
                  updatedAt: new Date().toISOString()
                },
                task: {
                  status: 'error',
                  message: `任务停止失败: ${error.message}`,
                  updatedAt: new Date().toISOString()
                }
              });

              event.sender.send('stop-task-reply', {
                success: false,
                error: error.message
              });
            }
          });

          ipcRenderer.removeAllListeners('set-actuator-state');
          ipcRenderer.on('set-actuator-state', async (event, payload) => {
            try {
              const nextActuators = await syncFutureConfigActuators(payload?.actuators || payload || {});
              event.sender.send('set-actuator-state-reply', {
                success: true,
                actuators: nextActuators
              });
            } catch (error) {
              event.sender.send('set-actuator-state-reply', {
                success: false,
                error: error.message
              });
            }
          });

          ipcRenderer.removeAllListeners('shutdown-workflow');
          ipcRenderer.on('shutdown-workflow', async (event) => {
            try {
              if (GLOBALS?.nodeController?.forceStop) {
                await GLOBALS.nodeController.forceStop();
              } else if (GLOBALS?.nodeController?.stop) {
                await GLOBALS.nodeController.stop();
              }
              event.sender.send('shutdown-workflow-reply', {
                success: true
              });
            } catch (error) {
              event.sender.send('shutdown-workflow-reply', {
                success: false,
                error: error.message
              });
            }
          });

          GLOBALS.updateRuntimeState = async (partialState) => {
            try {
              const result = await ipcRenderer.invoke('update-runtime-state', partialState);
              await syncFutureConfigRuntime(partialState);
              return result;
            } catch (error) {
              console.error('更新运行状态失败:', error);
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
                await syncFutureConfigActuators(GLOBALS.manualActuatorState || DEFAULT_MANUAL_ACTUATORS);
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
