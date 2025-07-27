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

const SimulationManager = ({ visible, onClose }) => {
  const [simulations, setSimulations] = useState([]);
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
      message.error('获取仿真平台列表失败');
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
          title: '选择下载目录',
          defaultPath: process.env.HOME
        });
        if (!result.success) return;
        downloadPath = result.path;
      }
      const key = `install-${sim.name}`;
      setInstalling(prev => ({ ...prev, [sim.name]: true }));
      if (!isScript) {
        message.loading({ content: '正在下载...', key, duration: 0 });
      }
      await SimulationController.installSimulation(sim.name, {
        downloadPath,
        onProgress: (progress) => {
          if (!isScript) {
            message.loading({ content: `正在下载...${progress}%`, key, duration: 0 });
          }
        }
      });
      if (!isScript) {
        message.success({ content: '安装完成', key });
      } else {
        message.success('安装完成');
      }
      fetchSimulations();
    } catch (error) {
      message.error(`安装失败: ${error.message}`);
      console.log(error);
    } finally {
      setInstalling(prev => ({ ...prev, [sim.name]: false }));
    }
  };

  const handleStopInstall = async (sim) => {
    Modal.confirm({
      title: '确认停止下载',
      content: '当前下载进度仍在进行中，是否中断下载？',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      className: 'dark-modal',
      onOk: async () => {
        try {
          const key = `install-${sim.name}`;
          await stopDownload();
          message.destroy(key);
          message.info('下载已停止');
        } catch (error) {
          message.error('停止下载失败');
        } finally {
          setInstalling(prev => ({ ...prev, [sim.name]: false }));
        }
      }
    });
  };

  const handleManualInstall = async (sim) => {
    try {
      const result = await fileController.selectFile({
        title: `选择${sim.name}的启动脚本`,
        filters: [
          { name: 'Shell Scripts', extensions: ['sh'] }
        ]
      });
      if (result.success) {
        await SimulationController.setManualInstall(sim.name, result.filePath);
        message.success('已记录启动脚本，标记为已安装');
        fetchSimulations();
      }
    } catch (error) {
      message.error('选择文件失败');
    }
  };

  const handleOpenSettings = async (sim) => {
    const config = await SimulationController.getSimulationConfig(sim.name);
    setSettingsModal({ visible: true, platform: sim.name, config });
  };

  const handleSaveSettings = async (values) => {
    await SimulationController.setSimulationConfig(settingsModal.platform, values);
    message.success('配置已保存');
    setSettingsModal({ ...settingsModal, visible: false });
  };

  const handleStart = async (sim) => {
    try {
      await SimulationController.startSimulation(sim.name);
      message.success(`${sim.name} 启动成功`);
    } catch (error) {
      message.error(`${sim.name} 启动失败: ${error.message}`);
    }
  };

  const handleControl = async (sim) => {
    try {
      await SimulationController.controlSimulation(sim.name);
      message.success(`${sim.name} 控制脚本已启动`);
    } catch (error) {
      message.error(`${sim.name} 控制失败: ${error.message}`);
    }
  };

  const handleLaunchRqt = async () => {
    try {
      exec('rqt', (error) => {
        if (error) {
          message.error('启动rqt失败，请确保已安装ROS和rqt');
        } else {
          message.success('rqt启动成功');
        }
      });
    } catch (error) {
      message.error('启动rqt失败');
    }
  };

  const handleLaunchRviz = async () => {
    try {
      
      exec('rviz2', (error) => {
        if (error) {
          message.error('启动rviz失败，请确保已安装ROS和rviz');
        } else {
          message.success('rviz启动成功');
        }
      });
    } catch (error) {
      message.error('启动rviz失败');
    }
  };

  const handleViewTf = async () => {
    try {
      message.loading({ content: '正在生成TF树...', key: 'view-tf', duration: 0 });
      
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
              message.error('无法打开PDF文件');
            } else {
              message.success('TF树已生成并打开');
              
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
          message.warning('未找到生成的PDF文件');
        }
      } else {
        message.error('生成TF树失败');
      }
    } catch (error) {
      message.destroy('view-tf');
      message.error(`查看TF失败: ${error.message}`);
    }
  };

  return (
    <Modal
      title="仿真管理"
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
                  <div className="env-manager-env-version">版本: {sim.version}</div>
                </div>
                <div className="env-manager-env-actions">
                  {installed[sim.name] ? (
                    <>
                      <Button onClick={() => handleOpenSettings(sim)}>设置</Button>
                      {sim.dualLaunch ? (
                        <>
                          <Button type="primary" onClick={() => handleStart(sim)}>仿真</Button>
                          <Button type="default" onClick={() => handleControl(sim)}>控制</Button>
                        </>
                      ) : (
                        <Button type="primary" onClick={() => handleStart(sim)}>仿真</Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button onClick={() => handleManualInstall(sim)}>我已安装</Button>
                      <Button
                        type={installing[sim.name] ? 'default' : 'primary'}
                        danger={installing[sim.name]}
                        onClick={() =>
                          installing[sim.name]
                            ? handleStopInstall(sim)
                            : handleInstall(sim)
                        }
                      >
                        {installing[sim.name] ? '停止' : '安装'}
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