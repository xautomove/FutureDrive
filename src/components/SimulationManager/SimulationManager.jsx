import React, { useState, useEffect } from 'react';
import { Modal, Card, List, Button, message, Spin, Space } from 'antd';
import SimulationController from '../../controller/gui/SimulationController';
import SimulationSettingsModal from './SimulationSettingsModal';
import fileController from '../../controller/gui/FileController';
import './SimulationManager.css';
import { stopDownload } from '../../assets/js/http';
import commandExecutor from '../../assets/js/commandExecutor';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { useI18n } from '../../context/I18nContext';

const SimulationManager = ({ visible, onClose }) => {
  const [simulations, setSimulations] = useState([]);
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState({});
  const [installed, setInstalled] = useState({});
  const [settingsModal, setSettingsModal] = useState({ visible: false, platform: '', config: {} });

  const fetchSimulations = async () => {
    setLoading(true);
    try {
      const list = await SimulationController.getSimulationList();
      setSimulations(list);
      const status = {};
      for (const sim of list) {
        status[sim.name] = await SimulationController.checkSimulationInstalled(sim.name);
      }
      setInstalled(status);
    } catch (error) {
      message.error(t('simulationManager.fetchListFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchSimulations();
  }, [visible]);

  const handleInstall = async (sim) => {
    try {
      let downloadPath;
      const ext = sim.installScript.split('.').pop().toLowerCase();
      const isScript = ['py', 'sh'].includes(ext);
      if (isScript) {
        downloadPath = window.require('os').tmpdir();
      } else {
        const result = await fileController.selectDirectory({
          title: t('simulationManager.selectDirTitle'),
          defaultPath: process.env.HOME
        });
        if (!result.success) return;
        downloadPath = result.path;
      }
      const key = `install-${sim.name}`;
      setInstalling(prev => ({ ...prev, [sim.name]: true }));
      if (!isScript) {
        message.loading({ content: t('simulationManager.downloading'), key, duration: 0 });
      }
      await SimulationController.installSimulation(sim.name, {
        downloadPath,
        onProgress: (progress) => {
          if (!isScript) {
            message.loading({ content: t('simulationManager.downloadProgress', { progress }), key, duration: 0 });
          }
        }
      });
      if (!isScript) {
        message.success({ content: t('simulationManager.installDone'), key });
      } else {
        message.success(t('simulationManager.installDone'));
      }
      fetchSimulations();
    } catch (error) {
      message.error(t('simulationManager.installFailed', { msg: error.message }));
      console.log(error);
    } finally {
      setInstalling(prev => ({ ...prev, [sim.name]: false }));
    }
  };

  const handleStopInstall = async (sim) => {
    Modal.confirm({
      title: t('simulationManager.confirmStopTitle'),
      content: t('simulationManager.confirmStopContent'),
      okText: t('common.ok'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      className: 'dark-modal',
      onOk: async () => {
        try {
          const key = `install-${sim.name}`;
          await stopDownload();
          message.destroy(key);
          message.info(t('simulationManager.stopped'));
        } catch (error) {
          message.error(t('simulationManager.stopFailed'));
        } finally {
          setInstalling(prev => ({ ...prev, [sim.name]: false }));
        }
      }
    });
  };

  const handleManualInstall = async (sim) => {
    try {
      const result = await fileController.selectFile({
        title: `${t('simulationManager.settings')}: ${sim.name}`,
        filters: [
          { name: 'Shell Scripts', extensions: ['sh'] }
        ]
      });
      if (result.success) {
        await SimulationController.setManualInstall(sim.name, result.filePath);
        message.success(t('simulationManager.manualSetDone'));
        fetchSimulations();
      }
    } catch (error) {
      message.error(t('simulationManager.selectFileFailed'));
    }
  };

  const handleOpenSettings = async (sim) => {
    const config = await SimulationController.getSimulationConfig(sim.name);
    setSettingsModal({ visible: true, platform: sim.name, config });
  };

  const handleSaveSettings = async (values) => {
    await SimulationController.setSimulationConfig(settingsModal.platform, values);
    message.success(t('common.save'));
    setSettingsModal({ ...settingsModal, visible: false });
  };

  const handleStart = async (sim) => {
    try {
      await SimulationController.startSimulation(sim.name);
      message.success(t('simulationManager.startSuccess', { name: sim.name }));
    } catch (error) {
      message.error(t('simulationManager.startFailed', { name: sim.name, msg: error.message }));
    }
  };

  const handleControl = async (sim) => {
    try {
      await SimulationController.controlSimulation(sim.name);
      message.success(t('simulationManager.controlStarted', { name: sim.name }));
    } catch (error) {
      message.error(t('simulationManager.controlFailed', { name: sim.name, msg: error.message }));
    }
  };

  const handleLaunchRqt = async () => {
    try {
      exec('rqt', (error) => {
        if (error) {
          message.error(t('simulationManager.rqtStartFailed'));
        } else {
          message.success(t('simulationManager.rqtStarted'));
        }
      });
    } catch (error) {
      message.error(t('simulationManager.rqtStartFailed'));
    }
  };

  const handleLaunchRviz = async () => {
    try {
      
      exec('rviz2', (error) => {
        if (error) {
          message.error(t('simulationManager.rvizStartFailed'));
        } else {
          message.success(t('simulationManager.rvizStarted'));
        }
      });
    } catch (error) {
      message.error(t('simulationManager.rvizStartFailed'));
    }
  };

  const handleViewTf = async () => {
    try {
      message.loading({ content: t('simulationManager.tfGenerating'), key: 'view-tf', duration: 0 });
      
      const result = await commandExecutor.execute('ros2', ['run', 'tf2_tools', 'view_frames'], {
        cwd: '/tmp',
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8'
        }
      });

      message.destroy('view-tf');
      
      if (result.exitCode === 0) {
        const tmpDir = '/tmp';
        const files = fs.readdirSync(tmpDir);
        const pdfFile = files.find(file => file.match(/^frames_.*\.pdf$/));
        
        if (pdfFile) {
          const pdfPath = path.join(tmpDir, pdfFile);
          const gvFile = pdfFile.replace('.pdf', '.gv');
          const gvPath = path.join(tmpDir, gvFile);
          
          exec(`xdg-open "${pdfPath}"`, (error) => {
            if (error) {
              message.error(t('simulationManager.pdfOpenFailed'));
            } else {
              message.success(t('simulationManager.tfOpened'));
              
              setTimeout(() => {
                try {
                  if (fs.existsSync(pdfPath)) {
                    fs.unlinkSync(pdfPath);
                  } 
                  if (fs.existsSync(gvPath)) {
                    fs.unlinkSync(gvPath);
                  }
                } catch (deleteError) {
                  console.log('删除临时文件失败:', deleteError);
                }
              }, 3000);
            }
          });
        } else {
          message.warning(t('simulationManager.tfPdfNotFound'));
        }
      } else {
        message.error(t('simulationManager.tfFailed'));
      }
    } catch (error) {
      message.destroy('view-tf');
      message.error(t('simulationManager.viewTfFailed', { msg: error.message }));
    }
  };

  return (
    <Modal
      title={t('simulationManager.title')}
      open={visible}
      onCancel={onClose}
      footer={
        <div className="simulation-toolbar">
          <Space>
            <Button 
              type="default" 
              onClick={handleViewTf}
              className="toolbar-button"
            >
              TF
            </Button>
            <Button 
              type="default" 
              onClick={handleLaunchRqt}
              className="toolbar-button"
            >
              RQT
            </Button>
            <Button 
              type="default" 
              onClick={handleLaunchRviz}
              className="toolbar-button"
            >
              RViz
            </Button>
          </Space>
        </div>
      }
      width={700}
      className="simulation-manager-modal"
      destroyOnHidden
    >
      <Card className="env-manager-card" variant="borderless" style={{ boxShadow: 'none', margin: 0, padding: 0 }}>
        <Spin spinning={loading}>
          <List
            itemLayout="horizontal"
            dataSource={simulations}
            renderItem={sim => (
              <List.Item className="env-manager-list-item">
                <div className="env-manager-env-info">
                  <div className="env-manager-env-name">{sim.name}</div>
                  <div className="env-manager-env-desc">{sim.description}</div>
                  <div className="env-manager-env-version">{t('simulationManager.version')}: {sim.version}</div>
                </div>
                <div className="env-manager-env-actions">
                  {installed[sim.name] ? (
                    <>
                      <Button onClick={() => handleOpenSettings(sim)}>{t('simulationManager.settings')}</Button>
                      {sim.dualLaunch ? (
                        <>
                          <Button type="primary" onClick={() => handleStart(sim)}>{t('simulationManager.simulation')}</Button>
                          <Button type="default" onClick={() => handleControl(sim)}>{t('simulationManager.control')}</Button>
                        </>
                      ) : (
                        <Button type="primary" onClick={() => handleStart(sim)}>{t('simulationManager.simulation')}</Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button onClick={() => handleManualInstall(sim)}>{t('simulationManager.manualInstall')}</Button>
                      <Button
                        type={installing[sim.name] ? 'default' : 'primary'}
                        danger={installing[sim.name]}
                        onClick={() =>
                          installing[sim.name]
                            ? handleStopInstall(sim)
                            : handleInstall(sim)
                        }
                      >
                        {installing[sim.name] ? t('simulationManager.stop') : t('simulationManager.install')}
                      </Button>
                    </>
                  )}
                </div>
              </List.Item>
            )}
          />
        </Spin>
      </Card>
      
      <SimulationSettingsModal
        visible={settingsModal.visible}
        onClose={() => setSettingsModal({ ...settingsModal, visible: false })}
        platform={settingsModal.platform}
        config={settingsModal.config}
        onSave={handleSaveSettings}
        onUninstall={() => {
          setSettingsModal({ ...settingsModal, visible: false });
          fetchSimulations();
        }}
      />
    </Modal>
  );
};

export default SimulationManager; 