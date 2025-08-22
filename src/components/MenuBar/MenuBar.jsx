import React, { useState } from 'react';
import { Menu, Modal } from 'antd';
import './MenuBar.css';
import { log, LOG_TYPES } from '../../assets/js/utils';
import GLOBALS from '../../assets/js/globals';
import RosTopicManager from '../RosTopicManager/RosTopicManager';
import EnvManager from '../EnvManager/EnvManager';
import AboutModal from '../AboutModal/AboutModal';
import SimulationManager from '../SimulationManager/SimulationManager';
import SettingsModal from '../SettingsModal/SettingsModal';
import InstallExtensionModal from '../InstallExtensionModal/InstallExtensionModal';
import windowController from '../../controller/gui/WindowController';
const { shell } = require('electron');
import { message } from 'antd';
import config from '../../assets/js/config';
import { useI18n } from '../../context/I18nContext';

const DOCUMENTATION_URL = 'https://futuer.automoves.cn/docs/';

const MenuBar = ({ onOpenProject, onCloseProject, onCreateProject }) => {
  const { t } = useI18n();
  const [isRosTopicManagerVisible, setIsRosTopicManagerVisible] = useState(false);
  const [isEnvManagerVisible, setIsEnvManagerVisible] = useState(false);
  const [isAboutModalVisible, setIsAboutModalVisible] = useState(false);
  const [isSimulationManagerVisible, setIsSimulationManagerVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isInstallExtVisible, setIsInstallExtVisible] = useState(false);

  const debugConfig = config.get('debug');
  const [isDebugMode, setIsDebugMode] = useState(debugConfig?.enabled ?? GLOBALS.isDebug);

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
        Modal.confirm({
          title: t('menubar.docOpenTitle'),
          content: t('menubar.docOpenContent'),
          okText: t('common.ok'),
          cancelText: t('common.cancel'),
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

        const redisConfig = config.get('redis') || {};
        if (!redisConfig.enabled) {
          message.warning('请先在设置中启用 Redis 缓存功能');
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
        } catch (error) {
          console.log(`流程执行失败`, error);
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
      case 'debug':
        const newDebug = !isDebugMode;
        setIsDebugMode(newDebug);
        GLOBALS.isDebug = newDebug;
        await config.set('debug', { enabled: newDebug });
        const debugStatus = newDebug ? t('common.on') : t('common.off');
        log(`调试模式已${newDebug ? '开启' : '关闭'}`, newDebug ? LOG_TYPES.INFO : LOG_TYPES.SUCCESS);
        message.success(`${t('menubar.debug')} ${debugStatus}`);
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
      case 'install_ext':
        setIsInstallExtVisible(true);
        break;
      default:
        break;
    }
  };

  const menuItems = [
    {
      key: 'project',
      label: t('menubar.project'),
      children: [
        { key: 'new', label: t('menubar.new') },
        { key: 'open', label: t('menubar.open') },
        { key: 'close', label: t('menubar.close') },
      ],
    },
    {
      key: 'run',
      label: t('menubar.run'),
      children: [
        { key: 'start', label: t('menubar.start') },
        { key: 'stop', label: t('menubar.stop') },
        { key: 'debug', label: `${t('menubar.debug')} (${isDebugMode ? t('common.on') : t('common.off')})` },
      ],
    },
    {
      key: 'tools',
      label: t('menubar.tools'),
      children: [
        { key: 'settings', label: t('menubar.settings') },
        { key: 'rostool', label: t('menubar.rostool') },
        { key: 'env', label: t('menubar.env') },
        { key: 'simulation', label: t('menubar.simulation') },
        { key: 'maptool', label: t('menubar.maptool') },
        { key: 'install_ext', label: t('menubar.installExt') },
      ],
    },
    {
      key: 'help',
      label: t('menubar.help'),
      children: [
        { key: 'documentation', label: t('menubar.documentation') },
        { key: 'about', label: t('menubar.about') },
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
        title={t('envManager.title')}
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
      <InstallExtensionModal
        visible={isInstallExtVisible}
        onClose={() => setIsInstallExtVisible(false)}
      />
    </div>
  );
};

export default MenuBar; 