import React, { useState, useEffect } from 'react';
import { Tree, Button, Space, Modal, Form, Input, Select, Switch, Tabs, message } from 'antd';
import './HardwareManager.css';
import HardwareController from '../../controller/gui/HardwareController';
import { useI18n } from '../../context/I18nContext';
const { dialog } = window.require('@electron/remote');
const path = window.require('path');
const fs = window.require('fs');
let hc = null

const DeviceModal = ({ visible, onOk, onCancel, onTreeDataChange, mode = 'add', device = null }) => {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const [deviceType, setDeviceType] = useState(device?.device_type || 'sensor');
  const [scriptDir, setScriptDir] = useState(device?.custom_driver?.script_directory || '');
  const [driverList, setDriverList] = useState([]);

  const resetForm = () => {
    form.resetFields();
    setDeviceType('sensor');
    setScriptDir('');
  };

  useEffect(() => {
    if (visible) {
      if (device) {
        form.setFieldsValue({
          name: device.device_name,
          model: device.device_model,
          topic: device.topic,
          enabled: device.enabled,
          remark: device.remarks
        });
        setDeviceType(device.device_type);
        setScriptDir(device.custom_driver?.script_directory || '');
      } else {
        resetForm();
      }
      hc.getDriverList().then(list => {
        if (Array.isArray(list)) setDriverList(list);
      });
    }
  }, [visible, device, form]);

  const handleSelectDir = async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths && result.filePaths[0]) {
      setScriptDir(result.filePaths[0]);
    }
  };

  const handleFinish = (values) => {
    const projectPath = window.currentProject?.path;
    if (!projectPath) {
      message.error('需要先打开项目');
      return;
    }
    const deviceData = {
      device_name: values.name,
      device_type: deviceType,
      device_model: values.model,
      topic: values.topic,
      enabled: values.enabled,
      remarks: values.remark,
      custom_driver: deviceType === 'other' && scriptDir ? {
        script_directory: scriptDir,
        script_file: 'main.py',
        enabled: true
      } : ''
    };

    try {
      if (hc == null) {
        return;
      }
      const config = hc.readConfig();
      const devices = config.devices || [];

      if (mode === 'add') {
        hc.addDevice(deviceData);
        message.success('硬件添加成功！');
      } else {
        const deviceIndex = devices.findIndex(d => d.device_name === device.device_name);
        if (deviceIndex !== -1) {
          devices[deviceIndex] = deviceData;
          hc.writeConfig({ ...config, devices });
          message.success('硬件更新成功！');
        }
      }

      onOk(deviceData);
      if (typeof onTreeDataChange === 'function') {
        onTreeDataChange();
      }
    } catch (e) {
      message.error(`${mode === 'add' ? '添加' : '更新'}硬件失败: ${e.message}`);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <Modal
      title={mode === 'add' ? t('hardwareManager.addDevice') : t('hardwareManager.editDevice')}
      open={visible}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      destroyOnClose={true}
      width={520}
      className="add-device-modal"
      okText={mode === 'add' ? t('hardwareManager.okAdd') : t('hardwareManager.okSave')}
      cancelText={t('hardwareManager.cancel')}
      maskClosable={false}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ flex: '90px' }}
        wrapperCol={{ flex: 1 }}
        onFinish={handleFinish}
        initialValues={{
          enabled: true,
          name: device?.device_name || '',
          model: device?.device_model || '',
          topic: device?.topic || '',
          enabled: device?.enabled ?? true,
          remark: device?.remarks || '',
          custom_driver: '',
        }}
        style={{ gap: 8 }}
      >
        <Tabs
          activeKey={deviceType}
          onChange={setDeviceType}
          items={[
            { label: t('hardwareManager.tabSensor'), key: 'sensor' },
            { label: t('hardwareManager.tabOther'), key: 'other' }
          ]}
        />
        <Form.Item label={t('hardwareManager.name')} name="name" rules={[{ required: true, message: t('hardwareManager.nameRequired') }]}>
          <Input />
        </Form.Item>
        <Form.Item label={t('hardwareManager.model')} name="model" rules={[{ required: true, message: t('hardwareManager.modelRequired') }]}> 
          <Select
            placeholder={t('hardwareManager.modelPlaceholder')}
            onChange={value => {
              const driver = driverList.find(d => d.model === value);
              if (driver && driver.topic) {
                form.setFieldsValue({ topic: driver.topic });
              }
            }}
          >
            {driverList.map(driver => (
              <Select.Option
                key={driver.model}
                value={driver.model}
                title={`品牌: ${driver.brand} 版本: ${driver.version}`}
              >
                {driver.brand} - {driver.model}（v{driver.version}）
              </Select.Option>
            ))}
            <Select.Option value="other">{t('hardwareManager.modelOther')}</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label={t('hardwareManager.topic')} name="topic">
          <Input />
        </Form.Item>
        <Form.Item label={t('hardwareManager.enabled')} name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label={t('hardwareManager.remark')} name="remark">
          <Input.TextArea rows={3} />
        </Form.Item>
        {deviceType === 'other' && (
          <Form.Item label={t('hardwareManager.driverScript')} name="custom_driver">
            <Space.Compact style={{ width: '100%' }}>
              <Input value={scriptDir} readOnly placeholder={t('hardwareManager.selectDirPlaceholder')} style={{ minWidth: 0, backgroundColor: 'rgb(136, 136, 136)', color: '#fff' }} />
              <Button onClick={handleSelectDir}>{t('hardwareManager.selectDir')}</Button>
            </Space.Compact>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

const HardwareManager = ({ onTreeDataChange }) => {
  const { t } = useI18n();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [treeData, setTreeData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });

  const checkAndInitHardwareConfig = (projectPath) => {
    try {
      const hardwareDir = path.join(projectPath, 'Hardware');
      const configPath = path.join(hardwareDir, 'config.json');

      if (!fs.existsSync(hardwareDir)) {
        fs.mkdirSync(hardwareDir, { recursive: true });
      }

      if (!fs.existsSync(configPath)) {
        const defaultConfig = {
          devices: []
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      }

      return true;
    } catch (error) {
      console.error('初始化硬件配置失败:', error);
      message.error(t('hardwareManager.initFailed'));
      return false;
    }
  };

  const loadTreeData = () => {
    try {
      const projectPath = window.currentProject?.path;
      if (!projectPath) {
        setTreeData([]);
        return;
      }

      if (!checkAndInitHardwareConfig(projectPath)) {
        return;
      }

      if (hc == null) {
        console.log("初始化失败");
        return;
      }
      const config = hc.readConfig();

      const devices = config.devices || [];
      const treeData = [
        {
          title: t('hardwareManager.listRoot'),
          key: 'root',
          children: [
            {
              title: t('hardwareManager.listSensors'),
              key: 'sensors',
              children: devices
                .filter(device => device.device_type === 'sensor')
                .map(device => ({
                  title: device.device_name,
                  key: `sensor-${device.device_name}`,
                  isLeaf: true,
                  data: device
                }))
            },
            {
              title: t('hardwareManager.listOthers'),
              key: 'others',
              children: devices
                .filter(device => device.device_type === 'other')
                .map(device => ({
                  title: device.device_name,
                  key: `other-${device.device_name}`,
                  isLeaf: true,
                  data: device
                }))
            }
          ]
        }
      ];

      setTreeData(treeData);
      setExpandedKeys(['root', 'sensors', 'others']);
    } catch (error) {
      console.error('加载硬件配置失败:', error);
      message.error(t('hardwareManager.initFailed'));
    }
  };

  useEffect(() => {
    if (window.currentProject?.path) {
      if (hc == null) {
        const projectPath = window.currentProject?.path;
        hc = new HardwareController(projectPath);
      }
      loadTreeData();
    }
  }, [window.currentProject?.path]);

  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  const handleContextMenu = (e, node) => {
    e.preventDefault();
    if (node.key.startsWith('sensor-') || node.key.startsWith('other-')) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      Modal.confirm({
        title: t('hardwareManager.confirmDelete'),
        content: t('hardwareManager.confirmDeleteContent', { name: contextMenu.node.title }),
        okText: t('common.ok'),
        cancelText: t('common.cancel'),
        okButtonProps: {
          style: {
            background: '#1976d2',
            borderColor: '#1976d2'
          }
        },
        cancelButtonProps: {
          style: {
            background: '#3d3d3d',
            borderColor: '#444',
            color: '#e0e0e0'
          }
        },
        className: 'custom-modal',
        onOk: () => {
          try {
            const projectPath = window.currentProject?.path;
            if (!projectPath) {
              message.error(t('hardwareManager.needOpenProject'));
              return;
            }

            const hc = new HardwareController(projectPath);
            const config = hc.readConfig();
            const devices = config.devices || [];

            const deviceIndex = devices.findIndex(device =>
              device.device_name === contextMenu.node.title
            );

            if (deviceIndex !== -1) {
              devices.splice(deviceIndex, 1);
              hc.writeConfig({ ...config, devices });
              message.success(t('hardwareManager.deleteSuccess'));
              loadTreeData(); 
            }
          } catch (error) {
            console.error('删除硬件失败:', error);
            message.error(t('hardwareManager.deleteFailed'));
          }
        }
      });
    }
    closeContextMenu();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      setSelectedDevice(contextMenu.node.data);
      setModalMode('edit');
      setModalVisible(true);
    }
    closeContextMenu();
  };

  const handleAdd = () => {
    setSelectedDevice(null);
    setModalMode('add');
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedDevice(null);
      setModalMode('add');
    }, 100);
  };

  return (
    <div className="hardware-manager">
      <Space direction="vertical" style={{ width: '100%' }}>
        {window.currentProject?.path && (
          <Space>
            <Button
              size="small"
              onClick={handleAdd}
            >
              {t('hardwareManager.addDevice')}
            </Button>
          </Space>
        )}
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          onRightClick={({ node, event }) => handleContextMenu(event, node)}
          showIcon
        />
      </Space>
      {modalVisible && (
        <DeviceModal
          key={`${modalMode}-${selectedDevice?.device_name || 'new'}`}
          visible={modalVisible}
          mode={modalMode}
          device={selectedDevice}
          onOk={() => {
            loadTreeData(); 
            if (typeof onTreeDataChange === 'function') {
              onTreeDataChange(); 
            }
            handleModalClose(); 
          }}
          onCancel={handleModalClose}
        />
      )}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
          }}
        >
          <div
            className="context-menu-item"
            onClick={handleEdit}
          >
            {t('hardwareManager.editDevice')}
          </div>
          <div
            className="context-menu-item"
            onClick={handleDelete}
          >
            {t('hardwareManager.delete')}
          </div>
        </div>
      )}
    </div>
  );
};

export default HardwareManager; 