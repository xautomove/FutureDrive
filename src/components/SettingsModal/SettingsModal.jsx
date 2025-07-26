import React, { useState, useEffect } from 'react';
import { Modal, Menu, Form, Input, Switch, InputNumber, Button, message } from 'antd';
import './SettingsModal.css';
import config from '../../assets/js/config';
import RedisController from '../../controller/node/RedisController';

const settingsList = [
  { key: 'general', label: '通用' },
  { key: 'node', label: '节点' },
  { key: 'api', label: 'API' },
  { key: 'redis', label: 'Redis' },
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
  const [redisEnabled, setRedisEnabled] = useState(false);
  const [testingRedis, setTestingRedis] = useState(false);
  const [nodeForm] = Form.useForm();
  const [apiForm] = Form.useForm();
  const [redisForm] = Form.useForm();
  const [otherForm] = Form.useForm();
  const [frameworkForm] = Form.useForm();

  useEffect(() => {
    if (visible) {
      const loadConfig = async () => {
        try {
          const nodeConfig = config.get('node') || {};
          const apiConfig = config.get('api') || {};
          const redisConfig = config.get('redis') || {};
          const otherConfig = config.get('other') || {};
          const frameworkConfig = config.get('framework') || {};

          setTimeout(() => {
            nodeForm.setFieldsValue({
              delay: nodeConfig.delay || 0,
              timeout: nodeConfig.timeout || 0,
              reportUrl: nodeConfig.reportUrl || '',
              pythonPath: nodeConfig.pythonPath || ''
            });

            apiForm.setFieldsValue({
              host: apiConfig.host || '127.0.0.1',
              port: apiConfig.port || 2200
            });

            redisForm.setFieldsValue({
              host: redisConfig.host || 'localhost',
              port: redisConfig.port || 6379,
              password: redisConfig.password || '',
              db: redisConfig.db || 0
            });

            setRedisEnabled(redisConfig.enabled || false);

            otherForm.setFieldsValue({
              noUi: otherConfig.noUi || false
            });

            setNoUi(otherConfig.noUi || false);

            frameworkForm.setFieldsValue({
              path: frameworkConfig.path || '',
            });

            setFrameworkPath(frameworkConfig.path || '');
          }, 0);
        } catch (error) {
          console.error('加载配置失败:', error);
        }
      };

      loadConfig();
    }
  }, [visible]);

  const handleMenuClick = (e) => {
    setSelectedKey(e.key);
  };

  const handleTestRedis = async () => {
    try {
      setTestingRedis(true);
      const redisValues = redisForm.getFieldsValue();
      
      const redisController = new RedisController();
      const connected = await redisController.initialize({
        host: redisValues.host || 'localhost',
        port: redisValues.port || 6379,
        password: redisValues.password || null,
        db: redisValues.db || 0
      });

      if (connected) {
        message.success('Redis 连接测试成功！');
        await redisController.set('test:connection', 'success', 10);
        const testValue = await redisController.get('test:connection');
        if (testValue === 'success') {
          message.success('Redis 读写测试成功！');
        }
        await redisController.disconnect();
      } else {
        message.error('Redis 连接测试失败，请检查配置！');
      }
    } catch (error) {
      console.error('Redis 测试失败:', error);
      message.error(`Redis 连接测试失败: ${error.message}`);
    } finally {
      setTestingRedis(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      console.log('保存设置');
      
      const nodeValues = nodeForm.getFieldsValue();
      const apiValues = apiForm.getFieldsValue();
      const redisValues = redisForm.getFieldsValue();
      const otherValues = otherForm.getFieldsValue();
      const frameworkValues = frameworkForm.getFieldsValue();
      
      await config.set('node', {
        ...nodeValues,
        delay: nodeValues.delay || 0,
        timeout: nodeValues.timeout || 0,
        reportUrl: nodeValues.reportUrl || '',
        pythonPath: nodeValues.pythonPath || ''
      });

      await config.set('api', {
        ...apiValues,
        host: apiValues.host || '127.0.0.1',
        port: apiValues.port || 2200,
        tokenEnabled: apiTokenEnabled,
        token: apiToken
      });

      await config.set('redis', {
        ...redisValues,
        host: redisValues.host || 'localhost',
        port: redisValues.port || 6379,
        password: redisValues.password || null,
        db: redisValues.db || 0,
        enabled: redisEnabled
      });

      await config.set('other', {
        ...otherValues,
        noUi: noUi
      });

      await config.set('framework', {
        ...frameworkValues,
        path: path
      });
      
      console.log('设置保存成功');
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
            <Form.Item name="pythonPath" label="Python路径">
              <Input placeholder="自定义python路径" style={{ width: 400 }} />
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
      case 'redis':
        return (
          <Form layout="vertical" className="settings-form" form={redisForm}>
            <Form.Item label="是否启用 Redis">
              <Switch checked={redisEnabled} onChange={setRedisEnabled} />
            </Form.Item>
            <Form.Item name="host" label="Redis 主机">
              <Input placeholder="localhost" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="port" label="Redis 端口">
              <InputNumber min={1} max={65535} placeholder="6379" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="password" label="Redis 密码">
              <Input.Password placeholder="请输入密码（可为空）" style={{ width: 200, backgroundColor: 'transparent', borderColor: '#ffffff54' }} />
            </Form.Item>
            <Form.Item name="db" label="Redis 数据库">
              <InputNumber min={0} max={15} placeholder="0" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Button 
                type="primary" 
                onClick={handleTestRedis} 
                loading={testingRedis}
                style={{ marginRight: 8 }}
              >
                测试连接
              </Button>
            </Form.Item>
            <div style={{ padding: 12}}>
              <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                <strong>说明：</strong>
                <br />• 启用 Redis 后，应用将使用 Redis 进行缓存存储
                <br />• 如果 Redis 连接失败，系统会自动使用内存缓存
                <br />• 修改配置后需要重启应用才能生效
                <br />• 建议在保存配置前先测试连接
              </p>
            </div>
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
      styles={{
        body: { maxHeight: 'calc(80vh - 110px)', overflow: 'hidden' }
      }}
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
          <div className="settings-form-content">
            {renderForm()}
          </div>
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