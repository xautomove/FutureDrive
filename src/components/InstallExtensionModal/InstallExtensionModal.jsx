import React, { useState } from 'react';
import { Modal, Input, Select, Button } from 'antd';
import './InstallExtensionModal.css';
import GLOBALS from '../../assets/js/globals';
import fs from 'fs';
import { useI18n } from '../../context/I18nContext';

const { Option } = Select;
const path = window.require('path');
const { exec } = window.require('child_process');

const nodePath = path.join(GLOBALS.USERDATA_DIR, 'node');
const pluginPath = path.join(GLOBALS.USERDATA_DIR, 'plugins');
const templatePath = window.currentProject && window.currentProject.path
  ? path.join(window.currentProject.path, 'templates')
  : '';
const driverPath = path.join(GLOBALS.USERDATA_DIR, 'drivers');

const DIR_MAP = {
  node: nodePath,
  template: templatePath,
  plugin: pluginPath,
  driver: driverPath,
};

const InstallExtensionModal = ({ visible, onClose }) => {
  const { t } = useI18n();
  const [repo, setRepo] = useState('');
  const [type, setType] = useState('node');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('');

  const handleInstall = async () => {
    if (!repo) {
      setLog(t('installExt.inputPlaceholder'));
      return;
    }
    setLoading(true);
    setLog('开始安装...\n');
    try {
      const baseDir = DIR_MAP[type];
      if (!baseDir) throw new Error(`未知类型: ${type}`);
      if (!fs.existsSync(baseDir)) throw new Error(`目标路径不存在: ${baseDir}`);

      const parts = repo.trim().split(/\s+/);
      const repoUrl = parts[0];
      const sparsePath = parts[1]; 

      if (!sparsePath) {
        const cmd = `cd "${baseDir}" && git clone --depth=1 ${repoUrl}`;
        exec(cmd, callback);
      } else {
        const tempDir = path.join(baseDir, 'temp_repo');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        const cmds = [
          `cd "${baseDir}"`,
          `git clone --depth=1 --filter=blob:none --sparse ${repoUrl} temp_repo`,
          `cd temp_repo`,
          `git sparse-checkout set ${sparsePath}`,
          `cd ..`,
          `mv temp_repo/${sparsePath} "${path.join(baseDir, sparsePath)}"`,
          `rm -rf temp_repo`
        ].join(' && ');

        exec(cmds, callback);
      }

      function callback(error, stdout, stderr) {
        if (error) {
          setLog(prev => prev + `安装失败: ${stderr || error.message}\n`);
          setLoading(false);
          return;
        }
        setLog(prev => prev + `安装成功!\n${stdout}`);
        setLoading(false);
      }
    } catch (e) {
      setLog(prev => prev + `发生异常: ${e.message}\n`);
      setLoading(false);
    }
  };

  const handleOpenMarket = () => {
    if (window.require) {
      const { shell } = window.require('electron');
      shell.openExternal('https://market.automoves.cn/');
    } else {
      window.open('https://market.automoves.cn/', '_blank');
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      title={t('installExt.title')}
      className="install-extension-modal"
    >
      <div className="install-ext-row">
        <Input
          placeholder={t('installExt.inputPlaceholder')}
          value={repo}
          onChange={e => setRepo(e.target.value)}
          style={{ width: '60%' }}
        />
        <Select
          value={type}
          onChange={setType}
          style={{ width: 120, marginLeft: 12 }}
        >
          <Option value="node">{t('installExt.select.node')}</Option>
          <Option value="template">{t('installExt.select.template')}</Option>
          <Option value="plugin">{t('installExt.select.plugin')}</Option>
          <Option value="driver">{t('installExt.select.driver')}</Option>
        </Select>
        <Button
          type="primary"
          loading={loading}
          onClick={handleInstall}
          style={{ marginLeft: 12 }}
        >
          {t('installExt.install')}
        </Button>
        <Button
          type="default"
          onClick={handleOpenMarket}
          style={{ marginLeft: 12 }}
          title={t('installExt.openMarket')}
        >
          {t('installExt.market')}
        </Button>
      </div>
      <div className="install-ext-log-title">{t('installExt.logTitle')}</div>
      <div className="install-ext-log-box">
        <pre>{log}</pre>
      </div>
    </Modal>
  );
};

export default InstallExtensionModal; 