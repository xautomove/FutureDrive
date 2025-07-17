import React,{ useEffect, useState, useRef } from 'react';
import { Card, List, Select, Button, message, Spin } from 'antd';
import EnvController from '../../controller/gui/EnvController';
import './EnvManager.css';
import { log, LOG_TYPES } from '../../assets/js/utils';

const EnvManager = () => {
  const [environments, setEnvironments] = useState([]);
  const [selectedVersions, setSelectedVersions] = useState({});
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  // 获取环境列表
  const fetchEnvironments = async () => {
    setLoading(true);
    try {
      const envs = await EnvController.getEnvironmentList();
      setEnvironments(envs);
    } catch (error) {
      console.error('获取环境列表失败:', error);
      message.error('获取环境列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      fetchEnvironments();
    }
  }, []);

  const refreshEnvironments = async () => {
    setLoading(true);
    try {
      setEnvironments([]);
      const envs = await EnvController.getEnvironmentList();
      setEnvironments(envs);
    } catch (error) {
      console.error('刷新环境列表失败:', error);
      message.error('刷新环境列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInstall = (env) => {
    const version = selectedVersions[env.name] || env.version;
    log(`正在安装 ${env.name} ${version}...`, LOG_TYPES.INFO);
    const installUrl = env.installUrl[process.platform === 'win32' ? 'windows' : 'ubuntu'];
    log(`安装地址: ${installUrl}`, LOG_TYPES.INFO);
    EnvController.installEnv(env, installUrl);
  };

  return (
    <Card 
      className="env-manager-card"
      title="环境管理"
      extra={
        <Button 
          onClick={refreshEnvironments}
          loading={loading}
        >
          刷新状态
        </Button>
      }
    >
      <Spin spinning={loading}>
        <List
          itemLayout="horizontal"
          dataSource={environments}
          renderItem={env => (
            <List.Item className="env-manager-list-item">
              <div className="env-manager-env-info">
                <div className="env-manager-env-name">{env.name}</div>
                <div className="env-manager-env-desc">{env.description}</div>
              </div>
              <div className="env-manager-env-actions">
                <div className="env-manager-env-version">
                  <span> {env.installed ? '当前' : '推荐'}版本: {env.version}</span>
                </div>
                <Button 
                  type="primary" 
                  onClick={() => handleInstall(env)}
                  disabled={env.installed}
                >
                  {env.installed ? '已安装' : '安装'}
                </Button>
                <span className="env-manager-env-status">
                  {env.installed ? (
                    <span style={{ color: '#4caf50' }}>✓ 已安装</span>
                  ) : (
                    <span style={{ color: '#f44336' }}>× 未安装</span>
                  )}
                </span>
              </div>
            </List.Item>
          )}
        />
      </Spin>
    </Card>
  );
};

export default EnvManager; 