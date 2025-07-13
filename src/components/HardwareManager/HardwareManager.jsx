import React, { useState, useEffect } from 'react';
import { Tree, Button, Space, Modal, Form, Input, Select, Switch, Tabs, message } from 'antd';
import './HardwareManager.css';
import HardwareController from '../../controller/gui/HardwareController';
const { dialog } = window.require('@electron/remote');
const path = window.require('path');
const fs = window.require('fs');
let hc = null

const DeviceModal = ({ visible, onOk, onCancel, onTreeDataChange, mode = 'add', device = null }) => {
  const [form] = Form.useForm();
  const [deviceType, setDeviceType] = useState(device?.device_type || 'sensor');
  const [scriptDir, setScriptDir] = useState(device?.custom_driver?.script_directory || '');
  const [driverList, setDriverList] = useState([]);

  // 重置表单
  const resetForm = () => {
    form.resetFields();
    setDeviceType('sensor');
    setScriptDir('');
  };

  // 当 visible 或 device 变化时更新表单
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
      // 加载驱动列表
      hc.getDriverList().then(list => {
        if (Array.isArray(list)) setDriverList(list);
      });
    }
  }, [visible, device, form]);

  // 选择目录（直接用 remote 的 dialog）
  const handleSelectDir = async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths && result.filePaths[0]) {
      setScriptDir(result.filePaths[0]);
    }
  };

  // 提交表单
  const handleFinish = (values) => {
    // 获取当前项目路径
    const projectPath = window.currentProject?.path;
    if (!projectPath) {
      message.error('需要先打开项目');
      return;
    }
    // 组装硬件数据
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
        console.log("未初始化");
        return;
      }
      const config = hc.readConfig();
      const devices = config.devices || [];

      if (mode === 'add') {
        // 添加硬件
        hc.addDevice(deviceData);
        message.success('硬件添加成功！');
      } else {
        // 编辑硬件
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

  // 处理取消
  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <Modal
      title={mode === 'add' ? "添加硬件" : "编辑硬件"}
      open={visible}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      destroyOnClose={true}
      width={520}
      className="add-device-modal"
      okText={mode === 'add' ? "添加硬件" : "保存"}
      cancelText="取消"
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
            { label: '传感器', key: 'sensor' },
            { label: '其他', key: 'other' }
          ]}
        />
        <Form.Item label="硬件名称" name="name" rules={[{ required: true, message: '请输入硬件名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="硬件型号" name="model" rules={[{ required: true, message: '请选择硬件型号' }]}>
          <Select
            placeholder="请选择硬件型号"
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
            <Select.Option value="other">其他</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="话题" name="topic">
          <Input />
        </Form.Item>
        <Form.Item label="启用" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={3} />
        </Form.Item>
        {deviceType === 'other' && (
          <Form.Item label="驱动脚本" name="custom_driver">
            <Space.Compact style={{ width: '100%' }}>
              <Input value={scriptDir} readOnly placeholder="请选择目录" style={{ minWidth: 0, backgroundColor: 'rgb(136, 136, 136)', color: '#fff' }} />
              <Button onClick={handleSelectDir}>选择目录</Button>
            </Space.Compact>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

const HardwareManager = ({ onTreeDataChange }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [treeData, setTreeData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });

  // 检查并初始化硬件配置
  const checkAndInitHardwareConfig = (projectPath) => {
    try {
      const hardwareDir = path.join(projectPath, 'Hardware');
      const configPath = path.join(hardwareDir, 'config.json');

      // 检查 Hardware 文件夹是否存在
      if (!fs.existsSync(hardwareDir)) {
        fs.mkdirSync(hardwareDir, { recursive: true });
      }

      // 检查 config.json 是否存在
      if (!fs.existsSync(configPath)) {
        // 创建默认配置
        const defaultConfig = {
          devices: []
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      }

      return true;
    } catch (error) {
      console.error('初始化硬件配置失败:', error);
      message.error('初始化硬件配置失败');
      return false;
    }
  };

  // 从 config.json 读取数据并转换为树形结构
  const loadTreeData = () => {
    try {
      const projectPath = window.currentProject?.path;
      if (!projectPath) {
        setTreeData([]);
        return;
      }

      // 检查并初始化硬件配置
      if (!checkAndInitHardwareConfig(projectPath)) {
        return;
      }

      if (hc == null) {
        console.log("初始化失败");
        return;
      }
      const config = hc.readConfig();

      // 将硬件配置转换为树形结构
      const devices = config.devices || [];
      const treeData = [
        {
          title: '硬件列表',
          key: 'root',
          children: [
            {
              title: '传感器',
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
              title: '其他硬件',
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
      // 默认展开根节点
      setExpandedKeys(['root', 'sensors', 'others']);
    } catch (error) {
      console.error('加载硬件配置失败:', error);
      message.error('加载硬件配置失败');
    }
  };

  // 监听项目变化
  useEffect(() => {
    if (window.currentProject?.path) {
      if (hc == null) {
        const projectPath = window.currentProject?.path;
        hc = new HardwareController(projectPath);
      }
      loadTreeData();
    }
  }, [window.currentProject?.path]);

  // 处理展开/折叠
  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  // 处理右键菜单
  const handleContextMenu = (e, node) => {
    e.preventDefault();
    // 只对硬件节点显示右键菜单
    if (node.key.startsWith('sensor-') || node.key.startsWith('other-')) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node
      });
    }
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // 点击其他地方时关闭右键菜单
  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // 删除硬件
  const handleDelete = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除硬件 "${contextMenu.node.title}" 吗？`,
        okText: '确定',
        cancelText: '取消',
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
              message.error('需要先打开项目');
              return;
            }

            const hc = new HardwareController(projectPath);
            const config = hc.readConfig();
            const devices = config.devices || [];

            // 找到要删除的硬件
            const deviceIndex = devices.findIndex(device =>
              device.device_name === contextMenu.node.title
            );

            if (deviceIndex !== -1) {
              // 删除硬件
              devices.splice(deviceIndex, 1);
              // 更新配置
              hc.writeConfig({ ...config, devices });
              message.success('删除成功');
              loadTreeData(); // 重新加载数据
            }
          } catch (error) {
            console.error('删除硬件失败:', error);
            message.error('删除硬件失败');
          }
        }
      });
    }
    closeContextMenu();
  };

  // 编辑硬件
  const handleEdit = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      setSelectedDevice(contextMenu.node.data);
      setModalMode('edit');
      setModalVisible(true);
    }
    closeContextMenu();
  };

  // 添加硬件
  const handleAdd = () => {
    setSelectedDevice(null);
    setModalMode('add');
    setModalVisible(true);
  };

  // 处理模态框关闭
  const handleModalClose = () => {
    setModalVisible(false);
    // 延迟重置状态，确保模态框完全关闭
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
              添加硬件
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
            loadTreeData(); // 刷新右侧硬件树
            if (typeof onTreeDataChange === 'function') {
              onTreeDataChange(); // 通知外部刷新左侧文件树
            }
            handleModalClose(); // 关闭模态框
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
            编辑
          </div>
          <div
            className="context-menu-item"
            onClick={handleDelete}
          >
            删除
          </div>
        </div>
      )}
    </div>
  );
};

export default HardwareManager; 