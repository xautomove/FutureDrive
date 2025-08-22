import React, { useState, useEffect } from 'react';
import { Modal, Menu, Form, Input, Switch, InputNumber, Button, message, Select } from 'antd';
import './SettingsModal.css';
import config from '../../assets/js/config';
import RedisController from '../../controller/node/RedisController';
import { useI18n } from '../../context/I18nContext';

const settingsList = [
  { key: 'general', label: 'general' },
  { key: 'node', label: 'node' },
  { key: 'api', label: 'api' },
  { key: 'redis', label: 'redis' },
  { key: 'other', label: 'other' },
  { key: 'framework', label: 'framework' },
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
  const [environmentForm] = Form.useForm();
  const { t, setLanguage } = useI18n();

  useEffect(() => {
    if (visible) {
      const loadConfig = async () => {
        try {
          const nodeConfig = config.get('node') || {};
          const apiConfig = config.get('api') || {};
          const redisConfig = config.get('redis') || {};
          const otherConfig = config.get('other') || {};
          const frameworkConfig = config.get('framework') || {};
          const environmentConfig = config.get('environment') || {};
          const currentLanguage = config.get('language') || 'zh-CN';

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

            environmentForm.setFieldsValue({
              listUrl: environmentConfig.listUrl || 'https://future.api.automoves.cn/api/environments/list',
              language: currentLanguage
            });
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
        message.success(t('settings.redis.connectSuccess'));
        await redisController.set('test:connection', 'success', 10);
        const testValue = await redisController.get('test:connection');
        if (testValue === 'success') {
          message.success(t('settings.redis.readWriteSuccess'));
        }
        await redisController.disconnect();
      } else {
        message.error(t('settings.redis.connectFailed'));
      }
    } catch (error) {
      console.error('Redis 测试失败:', error);
      message.error(`${t('settings.redis.connectionTestFailed')}: ${error.message}`);
    } finally {
      setTestingRedis(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const nodeValues = nodeForm.getFieldsValue();
      const apiValues = apiForm.getFieldsValue();
      const redisValues = redisForm.getFieldsValue();
      const otherValues = otherForm.getFieldsValue();
      const frameworkValues = frameworkForm.getFieldsValue();
      const environmentValues = environmentForm.getFieldsValue();
      
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

      await config.set('environment', {
        ...environmentValues,
        listUrl: environmentValues.listUrl || 'https://future.api.automoves.cn/api/environments/list'
      });

      await config.set('language', environmentValues.language || 'zh-CN');
      setLanguage(environmentValues.language || 'zh-CN');
      
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
          <Form layout="vertical" className="settings-form" form={environmentForm}>
            <Form.Item name="language" label={t('settings.general.language')}>
              <Select
                style={{ width: 200 }}
                options={[
                  { value: 'zh-CN', label: '中文' },
                  { value: 'en-US', label: 'English' }
                ]}
              />
            </Form.Item>
            <Form.Item name="listUrl" label={t('settings.general.environmentListUrl')}>
              <Input placeholder="https://future.api.automoves.cn/api/environments/list" style={{ width: 400 }} />
            </Form.Item>
          </Form>
        );
      case 'node':
        return (
          <Form layout="vertical" className="settings-form" form={nodeForm}>
            <Form.Item name="delay" label={t('settings.node.delay')}>
              <InputNumber min={0} placeholder={t('settings.node.delayPlaceholder')} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="timeout" label={t('settings.node.timeout')}>
              <InputNumber min={0} placeholder={t('settings.node.timeoutPlaceholder')} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="reportUrl" label={t('settings.node.reportUrl')}>
              <Input placeholder={t('settings.node.reportUrlPlaceholder')} style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="pythonPath" label={t('settings.node.pythonPath')}>
              <Input placeholder={t('settings.node.pythonPathPlaceholder')} style={{ width: 400 }} />
            </Form.Item>
          </Form>
        );
      case 'api':
        return (
          <Form layout="vertical" className="settings-form" form={apiForm}>
            <Form.Item name="host" label={t('settings.api.host')}>
              <Input placeholder="127.0.0.1" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="port" label={t('settings.api.port')}>
              <InputNumber min={1} max={65535} placeholder="2200" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label={t('settings.api.tokenEnabled')}>
              <Switch checked={apiTokenEnabled} onChange={setApiTokenEnabled} />
            </Form.Item>
            {apiTokenEnabled && (
              <Form.Item label={t('settings.api.token')}>
                <Input placeholder={t('settings.api.tokenPlaceholder')} style={{ width: 400 }} value={apiToken} onChange={e => setApiToken(e.target.value)} />
              </Form.Item>
            )}
          </Form>
        );
      case 'redis':
        return (
          <Form layout="vertical" className="settings-form" form={redisForm}>
            <Form.Item label={t('settings.redis.enabled')}>
              <Switch checked={redisEnabled} onChange={setRedisEnabled} />
            </Form.Item>
            <Form.Item name="host" label={t('settings.redis.host')}>
              <Input placeholder="localhost" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="port" label={t('settings.redis.port')}>
              <InputNumber min={1} max={65535} placeholder="6379" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="password" label={t('settings.redis.password')}>
              <Input.Password placeholder={t('settings.redis.passwordPlaceholder')} style={{ width: 200, backgroundColor: 'transparent', borderColor: '#ffffff54' }} />
            </Form.Item>
            <Form.Item name="db" label={t('settings.redis.db')}>
              <InputNumber min={0} max={15} placeholder="0" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Button 
                type="primary" 
                onClick={handleTestRedis} 
                loading={testingRedis}
                style={{ marginRight: 8 }}
              >
                {t('settings.redis.testConnection')}
              </Button>
            </Form.Item>
            <div style={{ padding: 12}}>
              <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{t('settings.redis.notes')}</p>
            </div>
          </Form>
        );
      case 'other':
        return (
          <Form layout="vertical" className="settings-form" form={otherForm}>
            <Form.Item label={t('settings.other.noUi')}>
              <Switch checked={noUi} onChange={setNoUi} />
            </Form.Item>
          </Form>
        );
      case 'framework':
        return (
          <Form layout="vertical" className="settings-form" form={frameworkForm}>
            <Form.Item label={t('settings.framework.path')}>
              <Input placeholder={t('settings.framework.pathPlaceholder')} style={{ width: 400 }} value={path} onChange={e => setFrameworkPath(e.target.value)} />
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
      title={t('menubar.settings')}
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
          items={settingsList.map(item => ({
            ...item,
            label: t(`settings.tabs.${item.label}`)
          }))}
        />
        <div className="settings-form-container">
          <div className="settings-form-content">
            {renderForm()}
          </div>
          <div className="settings-footer">
            <Button type="primary" onClick={handleSave} loading={loading}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal; 