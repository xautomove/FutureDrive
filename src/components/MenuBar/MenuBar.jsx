import React, { useRef, useState } from 'react';
import { Menu, Modal } from 'antd';
import './MenuBar.css';
import { log, LOG_TYPES } from '../../assets/js/utils';
import GLOBALS from '../../assets/js/globals';
import RosTopicManager from '../RosTopicManager/RosTopicManager';
import EnvManager from '../EnvManager/EnvManager';
import AboutModal from '../AboutModal/AboutModal';
import SimulationManager from '../SimulationManager/SimulationManager';
import SettingsModal from '../SettingsModal/SettingsModal';
import windowController from '../../controller/gui/WindowController';
const { shell } = require('electron');

const DOCUMENTATION_URL = 'https://futuer.automoves.cn/docs/';

const MenuBar = ({ onOpenProject, onCloseProject, onCreateProject }) => {
  const [isRosTopicManagerVisible, setIsRosTopicManagerVisible] = useState(false);
  const [isEnvManagerVisible, setIsEnvManagerVisible] = useState(false);
  const [isAboutModalVisible, setIsAboutModalVisible] = useState(false);
  const [isSimulationManagerVisible, setIsSimulationManagerVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  const handleMenuClick = async ({ key }) => {
    switch (key) {
      case 'new':
        if (typeof onCreateProject === 'function') {
          onCreateProject();
        }
        break;
      case 'open':
        if (typeof onOpenProject === 'function') {
          onOpenProject();
        }
        break;
      case 'close':
        if (typeof onCloseProject === 'function') {
          onCloseProject();
        }
        break;
      case 'documentation':
        console.log("open confirm")
        Modal.confirm({
          title: '打开文档',
          content: '是否在浏览器中打开文档？',
          okText: '确定',
          cancelText: '取消',
          className: 'menu-bar-modal',
          onOk: async () => {
            try {
              await shell.openExternal(DOCUMENTATION_URL);
            } catch (error) {
              log(`打开文档失败: ${error.message}`, LOG_TYPES.ERROR);
            }
            return true
          }
        });
        break;
      case 'start':
        if (GLOBALS.isRunning) {
          log('任务正在运行，请先停止或等待完成', LOG_TYPES.WARNING);
          return;
        }
        try {
          const nodes = window.flowNodes || [];
          const edges = window.flowEdges || [];
          
          if (nodes.length === 0) {
            log('没有可执行的节点', LOG_TYPES.WARNING);
            return;
          }

          log('开始执行流程...', LOG_TYPES.INFO);
          await GLOBALS.nodeController.start(nodes, edges);
          log('流程执行完成', LOG_TYPES.SUCCESS);
        } catch (error) {
          log(`流程执行失败`, LOG_TYPES.ERROR);
        }
        break;
      case 'stop':
        try {
          if (typeof GLOBALS.nodeController.forceStop === 'function') {
            await GLOBALS.nodeController.forceStop();
          } else {
            await GLOBALS.nodeController.stop();
          }
          log('流程已强制停止', LOG_TYPES.INFO);
        } catch (error) {
          log(`停止流程失败: ${error.message}`, LOG_TYPES.ERROR);
        }
        break;
      case 'rostool':
        setIsRosTopicManagerVisible(true);
        break;
      case 'env':
        setIsEnvManagerVisible(true);
        break;
      case 'simulation':
        setIsSimulationManagerVisible(true);
        break;
      case 'about':
        setIsAboutModalVisible(true);
        break;
      case 'settings':
        setIsSettingsModalVisible(true);
        break;
      case 'maptool':
        windowController.openViewer(1200, 800, 'map_editor', {});
        break;
      default:
        break;
    }
  };

  const menuItems = [
    {
      key: 'project',
      label: '项目',
      children: [
        { key: 'new', label: '新建项目' },
        { key: 'open', label: '打开项目' },
        { key: 'close', label: '关闭项目' },
      ],
    },
    {
      key: 'run',
      label: '运行',
      children: [
        { key: 'start', label: '开始运行' },
        { key: 'stop', label: '停止运行' },
        { key: 'debug', label: '调试模式' },
      ],
    },
    {
      key: 'tools',
      label: '工具',
      children: [
        { key: 'settings', label: '设置' },
        { key: 'rostool', label: '话题管理' },
        { key: 'env', label: '环境管理' },
        { key: 'simulation', label: '仿真管理' },
        { key: 'maptool', label: '地图工具' },
      ],
    },
    {
      key: 'help',
      label: '帮助',
      children: [
        { key: 'documentation', label: '文档' },
        { key: 'about', label: '关于' },
      ],
    },
  ];

  return (
    <div className="menu-bar">
      <Menu 
        mode="horizontal" 
        items={menuItems} 
        onClick={handleMenuClick}
        theme="dark"
      />
      <RosTopicManager 
        visible={isRosTopicManagerVisible}
        onClose={() => setIsRosTopicManagerVisible(false)}
      />
      <Modal
        open={isEnvManagerVisible}
        onCancel={() => setIsEnvManagerVisible(false)}
        footer={null}
        width={700}
        title="环境管理"
        className="env-manager-modal"
      >
        <EnvManager />
      </Modal>
      <AboutModal 
        visible={isAboutModalVisible}
        onClose={() => setIsAboutModalVisible(false)}
      />
      <SimulationManager
        visible={isSimulationManagerVisible}
        onClose={() => setIsSimulationManagerVisible(false)}
      />
      <SettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
      />
    </div>
  );
};

export default MenuBar; 