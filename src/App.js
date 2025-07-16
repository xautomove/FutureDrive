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

// 获取系统信息并设置window变量
async function getSystemInfo() {
  // 先检查是否有缓存的系统信息
  const cachedInfo = config.get('systemInfo');
  if (cachedInfo && cachedInfo.platform) {
    window.systemInfo = cachedInfo;
    return;
  }

  const platform = process.platform;
  let version = 'unknown';
  
  try {
    if (platform === 'linux') {
      // 读取Ubuntu版本信息
      const { execSync } = window.require('child_process');
      const osRelease = execSync('cat /etc/os-release', { encoding: 'utf-8' });
      const versionMatch = osRelease.match(/VERSION_ID="([^"]+)"/);
      version = versionMatch ? versionMatch[1] : 'unknown';
    } else if (platform === 'win32') {
      // 获取Windows版本 - 兼容中英文系统且异步执行
      const { exec } = window.require('child_process');
      
      // 方法1: 使用系统API获取版本
      try {
        version = process.getSystemVersion?.() || 'unknown';
      } catch (e) {
        console.log('使用process.getSystemVersion失败:', e);
      }
      
      // 方法2: 异步执行命令获取更详细信息
      if (version === 'unknown') {
        try {
          version = await new Promise((resolve) => {
            // 兼容中英文系统的命令
            const cmd = 'wmic os get caption,version /value';
            exec(cmd, { encoding: 'utf-8' }, (error, stdout) => {
              if (error) {
                console.error('获取Windows版本失败:', error);
                resolve('unknown');
                return;
              }
              
              // 解析WMIC输出
              const matches = stdout.match(/Version=([\d.]+)/);
              resolve(matches ? matches[1] : 'unknown');
            });
            
            // 设置5秒超时
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

  // 缓存系统信息
  window.systemInfo = systemInfo;
  await config.set('systemInfo', systemInfo);
}

function App() {
  const [Component, setComponent] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    // 使用window对象存储执行状态，确保在严格模式下也只执行一次
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
      //   // 这里可以 setState 或显示在页面上
      //   console.log(info);
      // });
    }

    // 初始化系统信息
    // getSystemInfo();
    
    if (initialized.current) return;
    initialized.current = true;

    const loadWindowParams = async () => {
      try {
        const { page, params } = await ipcRenderer.invoke('get-window-params');

        // 定义全局window变量，判断是否为主程序
        window.isMainWindow = page == "" ? 1 : 0;

        // 根据page值决定加载哪个组件
        if (page === 'show_topic') {
          const topic = params['topic'];
          setComponent(<TopicEchoViewer topic={topic} />);
        } else if (page === 'map_editor') {
          setComponent(<MapEditor />);
        } else {
          setComponent(<Layout />);
        }

        // 如果是主窗口，启动服务器并设置配置处理程序
        if (window.isMainWindow) {
          // 添加配置获取的处理程序
          ipcRenderer.removeAllListeners('get-config');
          ipcRenderer.on('get-config', (event, key) => {
            const value = config.get(key);
            event.sender.send('get-config-reply', value);
          });

          try {
            // 获取服务器配置
            const serverConfig = config.get('server') || {
              port: 2200,
              host: 'localhost'
            };
            
            // 通知主进程启动服务器
            await ipcRenderer.invoke('start-server', serverConfig);
            console.log('服务器启动成功');
          } catch (error) {
            console.error('启动服务器失败:', error);
            message.error('启动服务器失败');
          }
        }
      } catch (error) {
        console.error("获取窗口参数失败:", error);
        setComponent(<Layout />);
      }
    };

    loadWindowParams();

    // 组件卸载时停止服务器
    return () => {
      if (window.isMainWindow) {
        ipcRenderer.invoke('stop-server').catch(error => {
          console.error('停止服务器失败:', error);
        });
      }
    };
  }, []); // 只在组件挂载时执行一次

  // 如果Component为null，返回null，避免闪烁
  if (!Component) return null;

  return (
    <div className="App">
      {Component}
    </div>
  );
}

export default App; 