import React, { useState, useRef, useEffect,useCallback } from 'react';
import { Resizable } from 're-resizable';
import MenuBar from '../MenuBar/MenuBar';
import ProjectExplorer from '../ProjectExplorer/ProjectExplorer';
import MainContent from '../MainContent/MainContent';
import DebugConsole from '../DebugConsole/DebugConsole';
import HardwareManager from '../HardwareManager/HardwareManager';
import './Layout.css';
import ProjectController from '../../controller/gui/ProjectController';
import ProjectModal from '../ProjectModal/ProjectModal';
import { log, LOG_TYPES } from '../../assets/js/utils';
import WelcomeScreen from '../WelcomeScreen/WelcomeScreen';
import guiController from '../../controller/gui/GuiController';
import NodeController from '../../controller/node/NodeController';
import GLOBALS from '../../assets/js/globals';
const { ipcRenderer } = window.require('electron');

const Layout = () => {
  // 状态管理
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(250);
  const [debugHeight, setDebugHeight] = useState(200);
  const [minLeftWidth, setMinLeftWidth] = useState(200);
  const [minRightWidth, setMinRightWidth] = useState(200);
  const [projectTree, setProjectTree] = useState([]);
  const [currentProjectPath, setCurrentProjectPath] = useState('');
  const [projectConfig, setProjectConfig] = useState(null);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [recentProjects, setRecentProjects] = useState([]);
  
  const leftTreeRef = useRef(null);
  const rightTreeRef = useRef(null);

  // 自定义Hook确保方法只执行一次
  const useRunOnce = (fn, deps = []) => {
    const hasRun = useRef(false);
    
    useEffect(() => {
      if (hasRun.current) return;
      fn();
      hasRun.current = true;
    }, deps);
  };

  const initializeAppSettings = useCallback(() => {
    if (!window.systemInfo) {
      const checkSystemInfo = async () => {
        while (!window.systemInfo) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log(window.systemInfo);
      };
      checkSystemInfo();
    } else {
      console.log(window.systemInfo);
    }

  }, []);


  useRunOnce(initializeAppSettings, []);

  // 初始化全局NodeController
  useEffect(() => {
    if (!GLOBALS.nodeController) {
      GLOBALS.nodeController = new NodeController();
    }
  }, []);

  // 加载最近项目
  useEffect(() => {
    const recents = JSON.parse(localStorage.getItem('recentProjects') || '[]');
    setRecentProjects(recents);
  }, []);

  // 更新最小宽度
  useEffect(() => {
    const updateMinWidths = () => {
      if (leftTreeRef.current) {
        const leftTreeWidth = leftTreeRef.current.scrollWidth;
        setMinLeftWidth(Math.max(200, leftTreeWidth));
      }
      if (rightTreeRef.current) {
        const rightTreeWidth = rightTreeRef.current.scrollWidth;
        setMinRightWidth(Math.max(200, rightTreeWidth));
      }
    };

    updateMinWidths();
    window.addEventListener('resize', updateMinWidths);
    return () => window.removeEventListener('resize', updateMinWidths);
  }, []);

  // 打开项目
  const handleOpenProject = (projectPath, projectConfig) => {
    if (!projectPath) {
      ProjectController.selectAndOpenProject((path, config) => {
        if (path) {
          console.log("选择路径： " + path);
          openProjectByPath(path, config);
        }
      }, log, LOG_TYPES);
      return;
    }
    openProjectByPath(projectPath, projectConfig);
  };

  // 真正打开项目并更新最近项目
  const openProjectByPath = (projectPath, projectConfig) => {
    try {
      let config = projectConfig;
      // 如果没有传递配置，先读取 .proj 文件
      if (!config) {
        const pathModule = window.require ? window.require('path') : require('path');
        const fs = window.require ? window.require('fs') : require('fs');
        const projectName = pathModule.basename(projectPath);
        const projFile = pathModule.join(projectPath, `${projectName}.proj`);
        if (!fs.existsSync(projFile)) {
          log('无效的项目目录：找不到项目配置文件', LOG_TYPES.ERROR);
          return;
        }
        const projContent = fs.readFileSync(projFile, 'utf8');
        config = JSON.parse(projContent);
      }
      // 统一用 config.path 作为根目录，统一用 ProjectController.openProject
      const result = ProjectController.openProject(config.path);
      if (result.success) {
        window.currentProject = {
          path: config.path,
          config: result.config,
          tree: result.tree
        };
        console.log(window.currentProject);
        setProjectTree(result.tree);
        setCurrentProjectPath(config.path);
        setProjectConfig(result.config);
        // 通知主进程更新项目路径
        ipcRenderer.invoke('set-project-path', config.path);
        log(`成功打开项目: ${result.config.name}`, LOG_TYPES.SUCCESS);
        // 更新最近项目
        const recents = JSON.parse(localStorage.getItem('recentProjects') || '[]');
        const newRecents = [{ name: result.config.name, path: config.path }, ...recents.filter(p => p.path !== config.path)].slice(0, 10);
        localStorage.setItem('recentProjects', JSON.stringify(newRecents));
        setRecentProjects(newRecents);
      } else {
        message.error(`打开项目失败: ${result.error}`);
        log(`打开项目失败: ${result.error}`, LOG_TYPES.ERROR);
      }
    } catch (error) {
      message.error(`打开项目失败: ${error.message}`);
      log(`打开项目失败: ${error.message}`, LOG_TYPES.ERROR);
    }
  };

  // 更新项目树
  const handleTreeDataChange = () => {
    if (currentProjectPath) {
      const result = ProjectController.openProject(currentProjectPath);
      if (result.success) {
        setProjectTree(result.tree);
      }
    }
  };

  // 新建项目后自动打开
  const handleCreateProject = (projectPath) => {
    if (projectPath) {
      openProjectByPath(projectPath);
      setProjectModalVisible(false);
    }
  };

  // 关闭项目
  const handleCloseProject = () => {
    setCurrentProjectPath('');
    setProjectTree([]);
    setProjectConfig(null);
    // 通知主进程清除项目路径
    ipcRenderer.invoke('set-project-path', '');
    // 重置 GUI 控制器
    guiController.reset();
    // 可选：清理其它全局状态
    window.currentProject = { path: '', config: null, tree: [] };
  };

  // 没有项目时显示欢迎页
  if (!currentProjectPath) {
    return (
      <div className="layout">
        <MenuBar 
          onOpenProject={handleOpenProject} 
          onCloseProject={handleCloseProject}
          onCreateProject={() => setProjectModalVisible(true)}
        />
        <WelcomeScreen
          recentProjects={recentProjects}
          onOpenProject={handleOpenProject}
          onCreateProject={() => setProjectModalVisible(true)}
        />
        <ProjectModal
          visible={projectModalVisible}
          onClose={() => setProjectModalVisible(false)}
          onCreate={handleCreateProject}
          onOpenProject={handleOpenProject}
        />
      </div>
    );
  }

  return (
    <div className="layout">
      <MenuBar 
        onOpenProject={handleOpenProject} 
        onCloseProject={handleCloseProject}
        onCreateProject={() => setProjectModalVisible(true)}
      />
      <div className="main-container">
        {/* 左侧项目管理器 */}
        <Resizable
          size={{ width: leftWidth, height: '100%' }}
          onResizeStop={(e, direction, ref, d) => {
            setLeftWidth(leftWidth + d.width);
          }}
          minWidth={minLeftWidth}
          maxWidth={window.innerWidth * 0.4}
          enable={{ right: true }}
          className="project-explorer"
        >
          <div ref={leftTreeRef}>
            <ProjectExplorer 
              treeData={projectTree}
              projectName={projectConfig ? projectConfig.name : ''} 
              onTreeDataChange={handleTreeDataChange}
            />
          </div>
        </Resizable>

        {/* 中间内容区域 */}
        <div className="center-content">
          <div className="main-content">
            <MainContent onTreeDataChange={handleTreeDataChange} />
          </div>
          <Resizable
            size={{ width: '100%', height: debugHeight }}
            onResizeStop={(e, direction, ref, d) => {
              setDebugHeight(debugHeight + d.height);
            }}
            minHeight={100}
            maxHeight={window.innerHeight * 0.8}
            enable={{ top: true }}
            className="debug-console"
          >
            <DebugConsole />
          </Resizable>
        </div>

        {/* 右侧硬件管理器 */}
        <Resizable
          size={{ width: rightWidth, height: '100%' }}
          onResizeStop={(e, direction, ref, d) => {
            setRightWidth(rightWidth - d.width);
          }}
          minWidth={minRightWidth}
          maxWidth={window.innerWidth * 0.4}
          enable={{ left: true }}
          className="hardware-manager"
        >
          <div ref={rightTreeRef}>
            <HardwareManager onTreeDataChange={handleTreeDataChange} />
          </div>
        </Resizable>
      </div>
      {/* 新建项目弹窗 */}
      <ProjectModal
        visible={projectModalVisible}
        onClose={() => setProjectModalVisible(false)}
        onCreate={handleCreateProject}
        onOpenProject={handleOpenProject}
      />
    </div>
  );
};

export default Layout; 