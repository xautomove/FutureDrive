import React from 'react';
import { Modal, Form, Input, Button, Space } from 'antd';
import fileController from '../../controller/gui/FileController';
import SimulationController from '../../controller/gui/SimulationController';
import GLOBALS from '../../assets/js/globals';
import { FolderOpenOutlined } from '@ant-design/icons';
import { shell } from 'electron';
import { useI18n } from '../../context/I18nContext';

const path = window.require ? window.require('path') : require('path');

const SimulationSettingsModal = ({ visible, onClose, platform, config, onSave, onUninstall }) => {
  const [form] = Form.useForm();
  const { t } = useI18n();

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
          <Form.Item label={t('simulationSettings.host')} name="host" rules={[{ required: true, message: t('simulationSettings.validateHost') }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label={t('simulationSettings.port')} name="port" rules={[{ required: true, message: t('simulationSettings.validatePort') }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label={t('simulationSettings.map')} name="map" rules={[{ message: t('simulationSettings.validateMap') }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label={t('simulationSettings.launchFile')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="launchFile" noStyle rules={[{ required: true, message: t('simulationSettings.validateChooseFile') }]}> 
                <Input
                  readOnly
                  placeholder={t('simulationSettings.chooseFilePlaceholder')}
                />
              </Form.Item>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={async () => {
                  const result = await fileController.selectFile({
                    title: t('simulationSettings.chooseFileTitle'),
                    filters: [
                      { name: 'Python/Shell', extensions: ['py', 'sh'] }
                    ]
                  });
                  if (result.success) {
                    form.setFieldsValue({ launchFile: result.filePath });
                  }
                }}
              >{t('simulationSettings.chooseFile')}</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={t('simulationSettings.launchArgs')} name="launchArgs">
            <Input placeholder={t('simulationSettings.launchArgsPlaceholder')} />
          </Form.Item>
        </>
      );
    } else if (platform === 'Gazebo') {
      return (
        <>
          <Form.Item label={t('simulationSettings.map')} name="map" rules={[{ message: t('simulationSettings.validateMap') }]}> 
            <Input /> 
          </Form.Item>
          <Form.Item label={t('simulationSettings.launchFile')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="launchFile" noStyle rules={[{ pattern: /\.(py|sh)$/i, message: t('simulationSettings.onlyPySh') }]}> 
                <Input
                  readOnly
                  placeholder={t('simulationSettings.chooseFileOptionalPlaceholder')}
                />
              </Form.Item>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={async () => {
                  const result = await fileController.selectFile({
                    title: t('simulationSettings.chooseFileTitle'),
                    defaultPath: path.join(GLOBALS.USERDATA_DIR, 'plugins'),
                    filters: [
                      { name: 'Python/Shell', extensions: ['py', 'sh'] }
                    ]
                  });
                  if (result.success) {
                    form.setFieldsValue({ launchFile: result.filePath });
                  }
                }}
              >{t('simulationSettings.chooseFile')}</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={t('simulationSettings.launchArgs')} name="launchArgs">
            <Input placeholder={t('simulationSettings.launchArgsPlaceholder')} />
          </Form.Item>
        </>
      );
    }
    return null;
  };

  return (
    <Modal
      title={t('simulationSettings.title', { platform })}
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
          <Button danger onClick={handleUninstall}>{t('simulationSettings.uninstall')}</Button>
          <Button onClick={handleOpenPluginDir}>{t('simulationSettings.pluginDir')}</Button>
        </div>
        <div>
          <Button onClick={onClose} style={{ marginRight: 8 }}>{t('simulationSettings.cancel')}</Button>
          <Button type="primary" onClick={handleOk}>{t('simulationSettings.save')}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SimulationSettingsModal; 