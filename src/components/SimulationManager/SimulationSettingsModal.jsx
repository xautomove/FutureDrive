import React from 'react';
import { Modal, Form, Input, Button, Space } from 'antd';
import fileController from '../../controller/gui/FileController';
import SimulationController from '../../controller/gui/SimulationController';
import GLOBALS from '../../assets/js/globals';
import { FolderOpenOutlined } from '@ant-design/icons';
import { shell } from 'electron';

const path = window.require ? window.require('path') : require('path');

const SimulationSettingsModal = ({ visible, onClose, platform, config, onSave, onUninstall }) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (visible) {
      let initial = { ...config };
      if (platform === 'Carla') {
        if (!('host' in initial) || !initial.host) initial.host = '127.0.0.1';
        if (!('port' in initial) || !initial.port) initial.port = '2000';
      }
      form.setFieldsValue(initial);
    }
  }, [visible, config, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSave(values);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  };

  const handleUninstall = async () => {
    await SimulationController.uninstallSimulation(platform);
    if (typeof onUninstall === 'function') {
      onUninstall();
    } else {
      onClose();
    }
  };

  const handleOpenPluginDir = () => {
    const fs = window.require ? window.require('fs') : require('fs');
    const path = window.require ? window.require('path') : require('path');
    const pluginDir = path.join(GLOBALS.USERDATA_DIR, 'plugins');
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }
    shell.openPath(pluginDir);
  };

  const renderFields = () => {
    if (platform === 'Carla') {
      return (
        <>
          <Form.Item label="Host" name="host" rules={[{ required: true, message: '请输入Host' }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label="Port" name="port" rules={[{ required: true, message: '请输入Port' }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label="Map" name="map" rules={[{ required: true, message: '请输入Map' }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label="启动文件" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="launchFile" noStyle rules={[{ required: true, message: '请选择启动文件' }]}> 
                <Input
                  readOnly
                  placeholder="请选择py或sh文件"
                />
              </Form.Item>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={async () => {
                  const result = await fileController.selectFile({
                    title: '选择启动文件',
                    filters: [
                      { name: 'Python/Shell', extensions: ['py', 'sh'] }
                    ]
                  });
                  if (result.success) {
                    form.setFieldsValue({ launchFile: result.filePath });
                  }
                }}
              >选择文件</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="启动参数" name="launchArgs">
            <Input placeholder="可选，追加到命令行，如 --foo bar" />
          </Form.Item>
        </>
      );
    } else if (platform === 'Gazebo') {
      return (
        <>
          <Form.Item label="Map" name="map" rules={[{ message: '请输入Map' }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label="启动文件" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="launchFile" noStyle rules={[{ pattern: /\.(py|sh)$/i, message: '只允许py或sh文件' }]}> 
                <Input
                  readOnly
                  placeholder="请选择py或sh文件（可选）"
                />
              </Form.Item>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={async () => {
                  const result = await fileController.selectFile({
                    title: '选择启动文件',
                    defaultPath: path.join(GLOBALS.USERDATA_DIR, 'plugins'),
                    filters: [
                      { name: 'Python/Shell', extensions: ['py', 'sh'] }
                    ]
                  });
                  if (result.success) {
                    form.setFieldsValue({ launchFile: result.filePath });
                  }
                }}
              >选择文件</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="启动参数" name="launchArgs">
            <Input placeholder="可选，追加到命令行，如 --foo bar" />
          </Form.Item>
        </>
      );
    }
    return null;
  };

  return (
    <Modal
      title={`仿真设置 - ${platform}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      className="simulation-settings-modal"
    >
      <Form form={form} layout="vertical">
        {renderFields()}
      </Form>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button danger onClick={handleUninstall}>卸载</Button>
          <Button onClick={handleOpenPluginDir}>插件目录</Button>
        </div>
        <div>
          <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" onClick={handleOk}>保存</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SimulationSettingsModal; 