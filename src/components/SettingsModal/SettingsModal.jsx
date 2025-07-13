import React, { useState, useEffect } from 'react';
import { Modal, Menu, Form, Input, Switch, InputNumber, Button } from 'antd';
import './SettingsModal.css';

const settingsList = [
  { key: 'general', label: '通用' },
  { key: 'node', label: '节点' },
  { key: 'api', label: 'API' },
  { key: 'other', label: '其他' },
  { key: 'framework', label: '框架' },
];

const SettingsModal = ({ visible, onClose }) => {
  const [selectedKey, setSelectedKey] = useState('general');
  const [apiTokenEnabled, setApiTokenEnabled] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [noUi, setNoUi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [path,setFrameworkPath] = useState('');
  const [nodeForm] = Form.useForm();
  const [apiForm] = Form.useForm();
  const [otherForm] = Form.useForm();
  const [frameworkForm] = Form.useForm();

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      nodeForm.setFieldsValue({
        delay: 0,
        timeout: 0,
        reportUrl: ''
      });
      apiForm.setFieldsValue({
        host: '127.0.0.1',
        port: 2200
      });
      otherForm.setFieldsValue({
        noUi: false
      });
      frameworkForm.setFieldsValue({
        path: '',
      });
    }
  }, [visible]);

  // 处理菜单切换
  const handleMenuClick = (e) => {
    setSelectedKey(e.key);
  };

  // 处理保存设置
  const handleSave = async () => {
    try {
      setLoading(true);
      // TODO: 保存设置到配置文件
      console.log('保存设置');
      
      //获取表单数据
      const nodeValues = nodeForm.getFieldsValue();
      const apiValues = apiForm.getFieldsValue();
      const otherValues = otherForm.getFieldsValue();
      const frameworkVales = frameworkForm.getFieldsValue();
      
      const settings = {
        node: {
          ...nodeValues,
          delay: nodeValues.delay || 0,
          timeout: nodeValues.timeout || 0,
          reportUrl: nodeValues.reportUrl || ''
        },
        api: {
          ...apiValues,
          host: apiValues.host || '127.0.0.1',
          port: apiValues.port || 2200,
          tokenEnabled: apiTokenEnabled,
          token: apiToken
        },
        other: {
          ...otherValues,
          noUi: noUi
        },
        framework:{
          ...frameworkVales,
          path: path
        }
      };
      
      console.log('设置数据:', settings);

      await new Promise(resolve => setTimeout(resolve, 500));
      onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (selectedKey) {
      case 'general':
        return (
          <div className="settings-empty">暂无设置项</div>
        );
      case 'node':
        return (
          <Form layout="vertical" className="settings-form" form={nodeForm}>
            <Form.Item name="delay" label="节点执行延迟 (ms)">
              <InputNumber min={0} placeholder="请输入延迟（毫秒）" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="timeout" label="节点超时时间 (ms)">
              <InputNumber min={0} placeholder="请输入超时时间（毫秒）" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="reportUrl" label="节点上报地址 URL">
              <Input placeholder="请输入上报地址 URL" style={{ width: 400 }} />
            </Form.Item>
          </Form>
        );
      case 'api':
        return (
          <Form layout="vertical" className="settings-form" form={apiForm}>
            <Form.Item name="host" label="API 主机">
              <Input placeholder="127.0.0.1" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="port" label="API 端口">
              <InputNumber min={1} max={65535} placeholder="2200" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label="是否启用 Token">
              <Switch checked={apiTokenEnabled} onChange={setApiTokenEnabled} />
            </Form.Item>
            {apiTokenEnabled && (
              <Form.Item label="Token 值">
                <Input placeholder="请输入 Token（可为空）" style={{ width: 400 }} value={apiToken} onChange={e => setApiToken(e.target.value)} />
              </Form.Item>
            )}
          </Form>
        );
      case 'other':
        return (
          <Form layout="vertical" className="settings-form" form={otherForm}>
            <Form.Item label="是否无 UI 启动">
              <Switch checked={noUi} onChange={setNoUi} />
            </Form.Item>
          </Form>
        );
      case 'framework':
        return (
          <Form layout="vertical" className="settings-form" form={frameworkForm}>
            <Form.Item label="框架路径">
              <Input placeholder="请输入框架路径" style={{ width: 400 }} value={path} onChange={e => setFrameworkPath(e.target.value)} />
            </Form.Item>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      title="设置"
      className="settings-modal"
    >
      <div className="settings-modal-content">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={handleMenuClick}
          className="settings-menu"
          items={settingsList}
        />
        <div className="settings-form-container">
          {renderForm()}
          <div className="settings-footer">
            <Button type="primary" onClick={handleSave} loading={loading}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal; 