import React, { useState, useEffect } from 'react';
import { Tabs, Button, Input, Select, message, Modal } from 'antd';
import { DownloadOutlined, PlayCircleOutlined, FolderOpenOutlined, StopOutlined } from '@ant-design/icons';
import { log, LOG_TYPES } from '../../assets/js/utils';
import config from '../../assets/js/config';
import fileController from '../../controller/gui/FileController';
import './SimulationManager.css';
import { download, stopDownload } from '../../assets/js/http';
import { exec } from 'child_process';

const { Option } = Select;

const SimulationManager = ({ visible, onClose }) => {
  const [carlaPath, setCarlaPath] = useState('');
  const [carlaStatus, setCarlaStatus] = useState('未安装');
  const [selectedMap, setSelectedMap] = useState('Town01');
  const [customMap, setCustomMap] = useState('');
  const [ip, setIp] = useState('localhost');
  const [port, setPort] = useState('2000');
  const [launchType, setLaunchType] = useState('default');
  const [customCommand, setCustomCommand] = useState('');
  const [savedCommands, setSavedCommands] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadPath, setDownloadPath] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [customArgs, setCustomArgs] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const simulationConfig = config.get('simulation');
      if (simulationConfig) {
        setCarlaPath(simulationConfig.carlaPath || '');
        setCarlaStatus(simulationConfig.carlaStatus || '未安装');
        setSelectedMap(simulationConfig.selectedMap || 'Town01');
        setCustomMap(simulationConfig.customMap || '');
        setIp(simulationConfig.ip || 'localhost');
        setPort(simulationConfig.port || '2000');
        setLaunchType(simulationConfig.launchType || 'default');
        setCustomCommand(simulationConfig.customCommand || '');
        setSavedCommands(simulationConfig.savedCommands || []);
        setDownloadPath(simulationConfig.downloadPath || '');
        setCustomArgs(simulationConfig.customArgs || '');
      }
    } catch (error) {
      log(`加载配置失败: ${error.message}`, LOG_TYPES.ERROR);
    }
  };

  const saveConfig = async () => {
    try {
      const simulationConfig = {
        carlaPath,
        carlaStatus,
        selectedMap,
        customMap,
        ip,
        port,
        launchType,
        customCommand,
        savedCommands,
        downloadPath,
        customArgs
      };
      await config.set('simulation', simulationConfig);
    } catch (error) {
      log(`保存配置失败: ${error.message}`, LOG_TYPES.ERROR);
    }
  };

  const handleSelectDownloadPath = async () => {
    try {
      const result = await fileController.selectDirectory();
      if (result.success) {
        const newPath = `${result.path}/CARLA.tar.gz`;
        setDownloadPath(newPath);
        await saveConfig();
      }
    } catch (error) {
      message.error(`选择下载路径失败: ${error.message}`);
    }
  };

  const handleSelectCarlaPath = async () => {
    try {
      const result = await fileController.selectFile({
        title: '选择CARLA启动文件',
        filters: [
          { name: 'Shell Scripts', extensions: ['sh'] }
        ]
      });
      if (result.success) {
        setCarlaPath(result.filePath);
        setCarlaStatus('已自定义选择');
        await saveConfig();
      }
    } catch (error) {
      message.error(`选择CARLA文件失败: ${error.message}`);
    }
  };
  

  const handleStopDownload = async () => {
    const key = 'download-progress';
    try {
      Modal.confirm({
        title: '确认停止下载',
        content: '当前下载进度仍在进行中，是否中断下载？',
        okText: '确认',
        cancelText: '取消',
        okButtonProps: { danger: true },
        className: 'dark-modal',
        onOk: async () => {
          await stopDownload();
          setIsDownloading(false);
          message.destroy(key);
          message.info('下载已停止');
        }
      });
    } catch (error) {
      console.error('停止下载失败', error);
      message.error('停止下载失败');
    }
  };

  const extractTarGz = (filePath) => {
    return new Promise((resolve, reject) => {
      const extractDir = filePath.replace('.tar.gz', '');
      const command = `mkdir -p "${extractDir}" && tar -xzf "${filePath}" -C "${extractDir}" --strip-components=1`;
      
      exec(command, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(extractDir);
      });
    });
  };

  const handleDownloadCarla = async () => {
    if (isDownloading) {
      handleStopDownload();
      return;
    }

    const key = 'download-progress';
    message.loading({ content: '正在下载 CARLA... 0%', key, duration: 0 });
    setIsDownloading(true);
    
    try {
      await download(
        'https://carla-releases.b-cdn.net/Linux/Carla-0.10.0-Linux-Shipping.tar.gz',
        downloadPath,
        (progress) => {
          console.log(`下载进度：${progress}%`);
          message.loading({ content: `正在下载 CARLA... ${progress}%`, key, duration: 0 });
        }
      );

      message.destroy(key);
      message.loading({ content: '正在解压 CARLA...', key, duration: 0 });

      const extractDir = await extractTarGz(downloadPath);
      
      setCarlaPath(extractDir + '/CarlaUnreal.sh');
      setCarlaStatus('已下载');
      await saveConfig();

      message.destroy(key);
      message.success('CARLA 下载并解压完成');
    } catch (error) {
      message.destroy(key);
      message.error(`下载或解压失败: ${error.message}`);
      console.error('下载或解压失败', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const checkCarlaProcess = () => {
    return new Promise((resolve) => {
      exec('ps aux | grep CarlaUnreal-Linux-Shipping | grep -v grep', (error, stdout) => {
        const isRunning = stdout.trim().length > 0;
        resolve(isRunning);
      });
    });
  };

  const killCarlaProcess = () => {
    return new Promise((resolve, reject) => {
      exec('ps aux | grep CarlaUnreal-Linux-Shipping | grep -v grep', (error, stdout) => {
        if (!stdout.trim()) {
          resolve();
          return;
        }

        const pid = stdout.split(/\s+/)[1];
        if (!pid) {
          resolve();
          return;
        }

        exec(`kill -9 ${pid}`, (killError) => {
          if (killError) {
            reject(new Error('无法结束CARLA进程'));
          } else {
            resolve();
          }
        });
      });
    });
  };

  const handleStartCarla = async () => {
    try {
      if (!carlaPath) {
        message.error('请先选择CARLA文件');
        return;
      }

      const carlaDir = carlaPath.substring(0, carlaPath.lastIndexOf('/'));
      
      const command = `gnome-terminal -- bash -c "cd '${carlaDir}' && bash '${carlaPath}'; exec bash"`;
      
      exec(command, async (error) => {
        if (error) {
          message.error(`启动失败: ${error.message}`);
          setCarlaStatus('启动失败');
          return;
        }
        message.success('CARLA 环境启动成功');
        setCarlaStatus('运行中');
        setIsRunning(true);
        await saveConfig();
      });
    } catch (error) {
      message.error(`启动失败: ${error.message}`);
      setCarlaStatus('启动失败');
    }
  };

  const handleStopCarla = async () => {
    try {
      Modal.confirm({
        title: '确认结束仿真',
        content: '是否确认要结束当前仿真客户端？',
        okText: '确认',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await killCarlaProcess();
            setTimeout(async () => {
              const isStillRunning = await checkCarlaProcess();
              if (!isStillRunning) {
                message.success('仿真已结束');
                setCarlaStatus('已停止');
                setIsRunning(false);
                await saveConfig();
              } else {
                message.error('结束仿真失败，请手动结束进程');
              }
            }, 1000);
          } catch (error) {
            message.error(`结束仿真失败: ${error.message}`);
          }
        }
      });
    } catch (error) {
      message.error(`操作失败: ${error.message}`);
    }
  };

  useEffect(() => {
    const checkProcess = async () => {
      console.log("检查CARLA进程状态");
      const isProcessRunning = await checkCarlaProcess();
      setIsRunning(isProcessRunning);
      if (isProcessRunning) {
        setCarlaStatus('运行中');
      } else {
        setCarlaStatus('未运行');
      }
    };
    checkProcess();
  }, []);

  const handleSelectPythonScript = async () => {
    try {
      const result = await fileController.selectFile({
        title: '选择Python脚本',
        filters: [
          { name: 'Python Files', extensions: ['py'] }
        ]
      });
      if (result.success) {
        setCustomCommand(result.filePath);
        await saveConfig();
      }
    } catch (error) {
      message.error(`选择Python脚本失败: ${error.message}`);
    }
  };

  const handleStartSimulation = async () => {
    try {
      if (carlaStatus !== '运行中') {
        message.error('请先启动 CARLA 环境');
        return;
      }

      const map = selectedMap === 'custom' ? customMap : selectedMap;
      let scriptPath;
      let command;
      
      if (launchType === 'default') {
        const carlaDir = carlaPath.substring(0, carlaPath.lastIndexOf('/'));
        scriptPath = `${carlaDir}/PythonAPI/examples/manual_control.py`;
        command = `python3 ${scriptPath} --host ${ip} -p ${port} ${customArgs}`;
      } else {
        scriptPath = customCommand;
        command = `python3 ${scriptPath} -m ${map} --host ${ip} -p ${port} ${customArgs}`;
      }
      
      const terminalCommand = `gnome-terminal -- bash -c "cd '${carlaPath.substring(0, carlaPath.lastIndexOf('/'))}' && ${command}; exec bash"`;
      
      exec(terminalCommand, (error) => {
        if (error) {
          message.error(`启动仿真失败: ${error.message}`);
          return;
        }
        message.success('仿真启动成功');
      });

      if (launchType === 'custom' && customCommand && !savedCommands.includes(customCommand)) {
        const newCommands = [...savedCommands, customCommand];
        setSavedCommands(newCommands);
        saveConfig();
      }
    } catch (error) {
      message.error(`启动失败: ${error.message}`);
    }
  };

  const items = [
    {
      key: 'environment',
      label: '环境',
      children: (
        <div className="simulation-section">
          <div className="section-content">
            <div className="status-item">
              <span className="label">安装状态：</span>
              <span className={`status ${carlaStatus !== '未安装' ? 'success' : 'warning'}`}>
                {carlaStatus}
              </span>
            </div>
            <div className="path-item">
              <span className="label">下载路径：</span>
              <Input 
                value={downloadPath} 
                readOnly 
                placeholder="请选择下载保存路径"
              />
              <Button 
                icon={<FolderOpenOutlined />}
                onClick={handleSelectDownloadPath}
              >
                选择路径
              </Button>
            </div>
            <div className="path-item">
              <span className="label">CARLA文件：</span>
              <Input 
                value={carlaPath} 
                readOnly 
                placeholder="请选择已下载的CARLA文件"
              />
              <Button 
                icon={<FolderOpenOutlined />}
                onClick={handleSelectCarlaPath}
              >
                选择文件
              </Button>
            </div>
            <Button 
              type="primary"
              icon={isDownloading ? <StopOutlined /> : <DownloadOutlined />}
              onClick={handleDownloadCarla}
              disabled={carlaStatus === '已安装'}
            >
              {isDownloading ? '停止下载' : '下载 CARLA'}
            </Button>
            <Button 
              type={isRunning ? "primary" : "default"}
              danger={isRunning}
              icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
              onClick={isRunning ? handleStopCarla : handleStartCarla}
            >
              {isRunning ? '结束仿真' : '开始仿真'}
            </Button>
          </div>
        </div>
      )
    },
    {
      key: 'simulation',
      label: '仿真',
      children: (
        <div className="simulation-section">
          <div className="section-content">
            <div className="config-item">
              <span className="label">地图：</span>
              <Select
                value={selectedMap}
                onChange={setSelectedMap}
                style={{ width: 200 }}
              >
                <Option value="Town01">Town10HD_Opt</Option>
                <Option value="Town02">Mine_01</Option>
                <Option value="Town03">OpenDriveMap</Option>
                <Option value="custom">自定义</Option>
              </Select>
              {selectedMap === 'custom' && (
                <Input
                  value={customMap}
                  onChange={e => setCustomMap(e.target.value)}
                  placeholder="请输入地图名称"
                  style={{ width: 200, marginLeft: 10 }}
                />
              )}
            </div>
            <div className="config-item">
              <span className="label">IP：</span>
              <Input
                value={ip}
                onChange={e => setIp(e.target.value)}
                style={{ width: 200 }}
              />
            </div>
            <div className="config-item">
              <span className="label">端口：</span>
              <Input
                value={port}
                onChange={e => setPort(e.target.value)}
                style={{ width: 200 }}
              />
            </div>
            <div className="config-item">
              <span className="label">启动脚本：</span>
              <Select
                value={launchType}
                onChange={setLaunchType}
                style={{ width: 200 }}
              >
                <Option value="default">默认演示</Option>
                <Option value="custom">自定义</Option>
              </Select>
              {launchType === 'custom' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 10 }}>
                  <Input
                    value={customCommand}
                    readOnly
                    placeholder="请选择Python脚本"
                    style={{ width: 400 }}
                  />
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={handleSelectPythonScript}
                    style={{ marginLeft: 8 }}
                  />
                </div>
              )}
            </div>
            <div className="config-item">
              <span className="label">附加参数：</span>
              <Input
                value={customArgs}
                onChange={e => {
                  setCustomArgs(e.target.value);
                  saveConfig();
                }}
                placeholder="请输入额外的命令行参数"
                style={{ width: 600 }}
              />
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <Modal
      title="仿真管理"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      className="simulation-manager-modal"
    >
      <Tabs defaultActiveKey="environment" items={items} />
      <div className="modal-footer">
        <Button type="primary" onClick={handleStartSimulation}>
          开始仿真
        </Button>
      </div>
    </Modal>
  );
};

export default SimulationManager; 