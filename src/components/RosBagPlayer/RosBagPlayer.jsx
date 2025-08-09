import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Progress, message, Spin } from 'antd';
import { PlayCircleOutlined, StopOutlined, FileOutlined } from '@ant-design/icons';
import './RosBagPlayer.css';
import commandExecutor from '../../assets/js/commandExecutor';
import { log, LOG_TYPES } from '../../assets/js/utils';

const RosBagPlayer = ({ visible, onClose }) => {
  const [bagPath, setBagPath] = useState('');
  const [bagInfo, setBagInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const playProcessRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setBagPath('');
      setBagInfo(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setTotalDuration(0);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (playProcessRef.current) {
        try {
          playProcessRef.current.kill('SIGINT');
        } catch (e) {
          // 忽略错误
        }
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const selectBagFile = async () => {
    try {
      const { dialog } = window.require('@electron/remote');
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'ROS Bag Files', extensions: ['bag', 'db3'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        setBagPath(result.filePaths[0]);
        await getBagInfo(result.filePaths[0]);
      }
    } catch (error) {
      message.error('选择文件失败：' + error.message);
    }
  };

  const getBagInfo = async (path) => {
    setLoading(true);
    try {
      const result = await commandExecutor.execute('ros2', ['bag', 'info', path]);
      const info = parseBagInfo(result.stdout);
      setBagInfo(info);
      setTotalDuration(info.durationSeconds);
    } catch (error) {
      message.error('获取包信息失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const parseBagInfo = (output) => {
    const lines = output.split('\n');
    const info = {};
    
    for (const line of lines) {
      if (line.includes('Duration:')) {
        const durationMatch = line.match(/Duration:\s*([\d.]+)s/);
        if (durationMatch) {
          const seconds = parseFloat(durationMatch[1]);
          info.durationSeconds = seconds;
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.floor(seconds % 60);
          info.duration = `${minutes}m${remainingSeconds}s`;
        }
      } else if (line.includes('Start:')) {
        const startMatch = line.match(/Start:\s*(.+?)\s*\(([\d.]+)\)/);
        if (startMatch) {
          info.start = startMatch[1].trim();
          info.startTimestamp = parseFloat(startMatch[2]);
        } else {
          info.start = line.split('Start:')[1].trim();
        }
      } else if (line.includes('End:')) {
        const endMatch = line.match(/End:\s*(.+?)\s*\(([\d.]+)\)/);
        if (endMatch) {
          info.end = endMatch[1].trim();
          info.endTimestamp = parseFloat(endMatch[2]);
        } else {
          info.end = line.split('End:')[1].trim();
        }
      } else if (line.includes('Files:')) {
        info.files = line.split('Files:')[1].trim();
      } else if (line.includes('Bag size:')) {
        info.bagSize = line.split('Bag size:')[1].trim();
      } else if (line.includes('Messages:')) {
        info.messages = line.split('Messages:')[1].trim();
      } else if (line.includes('Topic information:')) {
        info.topicInfo = line.split('Topic information:')[1].trim();
      }
    }
    
    return info;
  };

  const startPlayback = async () => {
    if (!bagPath) {
      message.warning('请先选择ROS包文件');
      return;
    }

    try {
      setIsPlaying(true);
      setCurrentTime(0);
      startTimeRef.current = Date.now();

      const args = ['bag', 'play', bagPath, '--clock'];
      const child = commandExecutor.executeFlow('ros2', args, {
        onStdout: (text) => {
          if (text.includes('closing')) {
            stopPlayback();
            message.success('ROS包播放完成');
          }
        },
        onStderr: (text) => {
          if (text.toLowerCase().includes('error')) {
            log(`Bag play error: ${text}`, LOG_TYPES.ERROR);
            stopPlayback();
          }
        }
      });

      playProcessRef.current = child;

      startProgressListener();

      message.success('开始回放ROS包');
    } catch (error) {
      message.error('启动回放失败：' + error.message);
      setIsPlaying(false);
    }
  };

  const stopPlayback = async () => {
    try {
      if (playProcessRef.current) {
        playProcessRef.current.kill('SIGINT');
        playProcessRef.current = null;
      }
      
      stopProgressListener();
      setIsPlaying(false);
      setCurrentTime(0);
      message.success('回放已停止');
    } catch (error) {
      message.error('停止回放失败：' + error.message);
    }
  };

  const startProgressListener = () => {
    progressIntervalRef.current = setInterval(() => {
      if (startTimeRef.current && totalDuration > 0) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setCurrentTime(Math.min(elapsed, totalDuration));
      }
    }, 100);
  };

  const stopProgressListener = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    startTimeRef.current = null;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="ros-bag-player-window">
      <div className="ros-bag-player">
        <div className="ros-bag-player-section">
          <div className="ros-bag-player-path">
            <Input
              placeholder="选择ROS包文件"
              value={bagPath}
              onChange={e => setBagPath(e.target.value)}
              className="ros-bag-player-path-input"
            />
            <div className="ros-bag-player-path-buttons">
              <Button 
                icon={<FileOutlined />} 
                onClick={selectBagFile}
                title="选择文件"
                size="small"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="ros-bag-player-loading">
            <Spin size="small" />
            <span>正在获取包信息...</span>
          </div>
        )}

        {bagInfo && (
          <div className="ros-bag-player-info">
            <div className="ros-bag-player-info-item">
              <span className="label">文件：</span>
              <span className="value">{bagInfo.files}</span>
            </div>
            {bagInfo.bagSize && (
              <div className="ros-bag-player-info-item">
                <span className="label">大小：</span>
                <span className="value">{bagInfo.bagSize}</span>
              </div>
            )}
            <div className="ros-bag-player-info-item">
              <span className="label">时长：</span>
              <span className="value">{bagInfo.duration}</span>
            </div>
            <div className="ros-bag-player-info-item">
              <span className="label">开始：</span>
              <span className="value">{bagInfo.start}</span>
            </div>
            <div className="ros-bag-player-info-item">
              <span className="label">结束：</span>
              <span className="value">{bagInfo.end}</span>
            </div>
            {bagInfo.messages && (
              <div className="ros-bag-player-info-item">
                <span className="label">消息数：</span>
                <span className="value">{bagInfo.messages}</span>
              </div>
            )}
            {bagInfo.topicInfo && (
              <div className="ros-bag-player-info-item">
                <span className="label">话题信息：</span>
                <span className="value">{bagInfo.topicInfo}</span>
              </div>
            )}
          </div>
        )}

        <div className="ros-bag-player-progress">
          <div className="ros-bag-player-time">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
          <Progress 
            percent={progressPercent} 
            showInfo={false}
            className="ros-bag-player-progress-bar"
          />
        </div>

        <div className="ros-bag-player-controls">
          {!isPlaying ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startPlayback}
              disabled={!bagPath}
            >
              播放
            </Button>
          ) : (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={stopPlayback}
            >
              停止
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RosBagPlayer; 