import React,{ useEffect, useState, useRef } from 'react';
import { Card, List, Button, message, Spin } from 'antd';
import EnvController from '../../controller/gui/EnvController';
import './EnvManager.css';
import { log, LOG_TYPES } from '../../assets/js/utils';
import config from '../../assets/js/config';

const EnvManager = () => {
  const [environments, setEnvironments] = useState([]);
  const [selectedVersions, setSelectedVersions] = useState({});
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  const loadEnvironments = async (clearBeforeLoad = false, forceUpdate = false) => {
    setLoading(true);
    try {
      if (clearBeforeLoad) setEnvironments([]);
      if (forceUpdate) {
        config.set('environment.cacheDate', '');
        config.save?.();
      }
      const envs = await EnvController.getEnvironmentList();
      setEnvironments(envs);
    } catch (error) {
      message.error('获取环境列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadEnvironments();
    }
  }, []);
  
  const handleInstall = (env, installUrlOverride) => {
    const version = selectedVersions[env.name] || env.version;
    log(`正在安装 ${env.name} ${version}...`, LOG_TYPES.INFO);
    const installUrl = installUrlOverride || (process.platform === 'win32' ? env.install_url_windows : env.install_url_ubuntu);
    EnvController.installEnv(env, installUrl);
  };

  return (
    <Card 
      className="env-manager-card"
      title="环境管理"
      extra={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            onClick={() => {
              loadEnvironments(true,true);
            }}
            loading={loading}
            type="default"
          >
            获取最新
          </Button>
          <Button 
            onClick={() => loadEnvironments(true,false)}
            loading={loading}
            type="primary"
          >
            刷新状态
          </Button>
        </div>
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
                {(() => {
                  const raw = process.platform === 'win32' ? env.install_url_windows : env.install_url_ubuntu;
                  const urls = raw.split(';').map(s => s.trim()).filter(Boolean);
                  if (urls.length <= 1) {
                    return (
                      <Button
                        type="primary"
                        onClick={() => handleInstall(env, urls[0] || raw)}
                        disabled={env.installed}
                      >
                        {env.installed ? '已安装' : '安装'}
                      </Button>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {urls.map((u, idx) => (
                        <Button
                          key={`${env.name}-install-${idx}`}
                          type="primary"
                          onClick={() => handleInstall(env, u)}
                          disabled={env.installed}
                        >
                          {env.installed ? `已安装` : `安装${idx + 1}`}
                        </Button>
                      ))}
                    </div>
                  );
                })()}
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