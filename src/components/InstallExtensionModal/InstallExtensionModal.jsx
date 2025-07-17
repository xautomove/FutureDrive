import React, { useState, useRef } from 'react';
import { Modal, Input, Select, Button } from 'antd';
import './InstallExtensionModal.css';
import GLOBALS from '../../assets/js/globals';

const { Option } = Select;
const path = window.require('path');
const { exec } = window.require('child_process');

const nodePath = path.join(GLOBALS.USERDATA_DIR, 'node');
console.log(nodePath);

const DIR_MAP = {
  node: nodePath,
  template: 'templates',
  plugin: 'plugins',
};

const InstallExtensionModal = ({ visible, onClose }) => {
  const [repo, setRepo] = useState('');
  const [type, setType] = useState('node');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('');
  const logRef = useRef('');

  const handleInstall = async () => {
    if (!repo) {
      setLog('请输入安装指令');
      return;
    }
    setLoading(true);
    setLog('开始安装...\n');
    logRef.current = '开始安装...\n';
    try {
      const baseDir = path.join(process.cwd(), DIR_MAP[type]);
      const repoName = repo.split('/').pop().replace(/\.git$/, '');
      const destDir = path.join(baseDir, repoName);
      setLog(prev => prev + `目标目录: ${destDir}\n`);
      logRef.current += `目标目录: ${destDir}\n`;
      // git clone
      exec(`${repo} "${destDir}"`, (error, stdout, stderr) => {
        if (error) {
          setLog(prev => prev + `安装失败: ${stderr || error.message}\n`);
          setLoading(false);
          return;
        }
        setLog(prev => prev + `安装成功!\n${stdout}`);
        setLoading(false);
      });
    } catch (e) {
      setLog(prev => prev + `发生异常: ${e.message}\n`);
      setLoading(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      title="安装扩展"
      className="install-extension-modal"
    >
      <div className="install-ext-row">
        <Input
          placeholder="请输入安装指令"
          value={repo}
          onChange={e => setRepo(e.target.value)}
          style={{ width: '60%' }}
        />
        <Select
          value={type}
          onChange={setType}
          style={{ width: 120, marginLeft: 12 }}
        >
          <Option value="node">节点</Option>
          <Option value="template">模板</Option>
          <Option value="plugin">插件</Option>
        </Select>
        <Button
          type="primary"
          loading={loading}
          onClick={handleInstall}
          style={{ marginLeft: 12 }}
        >
          安装
        </Button>
      </div>
      <div className="install-ext-log-title">执行日志：</div>
      <div className="install-ext-log-box">
        <pre>{log}</pre>
      </div>
    </Modal>
  );
};

export default InstallExtensionModal; 