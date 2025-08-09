import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, List, Menu, message, Checkbox, Popconfirm } from 'antd';
import { SearchOutlined, ReloadOutlined, VideoCameraOutlined, FolderOpenOutlined, PoweroffOutlined, PlayCircleOutlined } from '@ant-design/icons';
import './RosTopicManager.css';
import rosController from '../../controller/ros/RosController';
import commandExecutor from '../../assets/js/commandExecutor';
import path from 'path';
import { log, LOG_TYPES } from '../../assets/js/utils';
import windowController from '../../controller/gui/WindowController';

const RosTopicManager = ({ visible, onClose }) => {
  const [topics, setTopics] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const [recordMode, setRecordMode] = useState(false);
  const [recordSelectedTopics, setRecordSelectedTopics] = useState([]);
  const [recordPath, setRecordPath] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const recordProcessRef = useRef(null);

  const fetchTopics = async () => {
    try {
      const topicList = await rosController.getTopicList();
      setTopics(topicList);
    } catch (error) {
      message.error(`获取话题列表失败: ${error.message}`);
    }
  };

  const copyTopicName = (topic) => {
    navigator.clipboard.writeText(topic).then(
      () => message.success('话题名称已复制到剪贴板'),
      () => message.error('复制失败')
    );
  };

  const viewTopicInfo = (topic) => {
    windowController.openViewer(800, 600, 'show_topic', { topic });
  };

  const handleContextMenu = (event, topic) => {
    event.preventDefault();
    setSelectedTopic(topic);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMenuClick = ({ key }) => {
    if (!selectedTopic) return;

    switch (key) {
      case 'view':
        viewTopicInfo(selectedTopic);
        break;
      case 'copy':
        copyTopicName(selectedTopic);
        break;
    }
    setContextMenu(null);
  };

  const filteredTopics = topics.filter(topic =>
    topic.toLowerCase().includes(searchText.toLowerCase())
  );

  useEffect(() => {
    if (visible) {
      fetchTopics();
    }
  }, [visible]);

  const handleRecordClick = () => {
    setRecordMode(!recordMode);
  };

  const handleRecordConfirm = async () => {
    if (!recordPath) {
      message.warning('请选择保存路径');
      return;
    }
    if (!recordSelectedTopics.length) {
      message.warning('请至少选择一个话题');
      return;
    }
    const cmd = 'ros2';
    const args = ['bag', 'record', ...recordSelectedTopics, '--output', recordPath];
    try {
      const proc = commandExecutor.executeFlow(cmd, args, {
        onStdout: (text) => {
          log(text, LOG_TYPES.INFO);
          if (text.includes('Recording...')) {
            setRecordingStarted(true);
            message.success('录制已开始');
          }
        },
        onStderr: (text) => {
          if (text.includes('[ERROR]') || text.includes('error') || text.includes('Error')) {
            log(text, LOG_TYPES.ERROR);
            if (text.includes("Output folder '") && text.includes("' already exists.")) {
              const match = text.match(/Output folder '(.+)' already exists\./);
              if (match && match[1]) {
                message.error(`文件已经存在：${match[1]}`);
              } else {
                message.error('文件已经存在');
              }
            }
          } else {
            if (text.includes('Recording...')) {
              setRecordingStarted(true);
              setIsRecording(true);
              message.success('录制已开始');
            } else if (text.includes('Recording stopped')) {
              message.success('录制已停止');
            }
          }
        },
      });
      recordProcessRef.current = proc;
      log(`启动录制进程: ${recordPath}`, LOG_TYPES.SUCCESS);
    } catch (e) {
      message.error('录制启动失败: ' + e.message);
      log(`录制启动失败: ${e.message}`, LOG_TYPES.ERROR);
    }
  };

  const handleRecordCancel = () => {
    setRecordMode(false);
    setRecordSelectedTopics([]);
    setRecordPath('');
  };

  const handleSelectFolder = async () => {
    try {
      const { dialog } = window.require('@electron/remote');
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        const bagFilePath = path.join(result.filePaths[0], `rosbag_${Date.now()}`);
        setRecordPath(bagFilePath);
      }
    } catch (error) {
      message.error('选择目录失败：' + error.message);
    }
  };

  const handleRestartRos = async () => {
    try {
      const findResult = await commandExecutor.execute('ps', ['-ef']);
      const lines = findResult.stdout.split('\n');
      const ros2Pids = [];

      for (const line of lines) {
        if (line.includes('/opt/ros/') || line.includes('ros2')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2 && !isNaN(parts[1]) && !line.includes('grep')) {
            ros2Pids.push(parts[1]);
          }
        }
      }

      for (const pid of ros2Pids) {
        try {
          await commandExecutor.execute('kill', ['-9', pid]);
        } catch (error) {
        }
      }

      try {
        await commandExecutor.execute('ros2', ['daemon', 'stop']);
      } catch (error) {
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        await commandExecutor.execute('ros2', ['daemon', 'start']);
      } catch (error) {
        message.warning(`启动daemon失败: ${error.message}`);
      }
      message.success('重启ROS成功');

      setTimeout(() => {
        fetchTopics();
      }, 2000);

    } catch (error) {
      message.error(`重启ROS失败: ${error.message}`);
    }
  };

  const handlePlayClick = () => {
    windowController.openViewer(800, 600, 'ros_bag_player', {});
  };

  const handleStopRecord = () => {
    if (recordProcessRef.current) {
      try {
        recordProcessRef.current.kill('SIGINT');
        setIsRecording(false);
        setRecordingStarted(false);
      } catch (e) {
        message.error('停止录制失败');
      }
    }
  };

  return (
    <>
      <Modal
        open={visible}
        onCancel={onClose}
        width={600}
        footer={null}
        className="ros-topic-manager-modal"
        maskClosable={true}
        styles={{
          mask: { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
        }}
        title="话题管理"
      >
        <div
          className="ros-topic-manager"
          onClick={() => contextMenu && setContextMenu(null)}
          onContextMenu={e => {
            if (contextMenu && e.target.classList.contains('ros-topic-manager')) {
              setContextMenu(null);
            }
          }}
        >
          <div className="ros-topic-manager-toolbar">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTopics}
              title="刷新话题列表"
              className="ros-topic-manager-toolbar-btn"
            />
            <Button
              icon={<VideoCameraOutlined />}
              onClick={handleRecordClick}
              title="录制"
              className="ros-topic-manager-toolbar-btn"
            />
            <Button
              icon={<PlayCircleOutlined />}
              onClick={handlePlayClick}
              title="回放ROS包"
              className="ros-topic-manager-toolbar-btn play-btn"
            />
            <Popconfirm
              title="重启ROS"
              description="这将结束所有ROS节点并重启Daemon，确定要继续吗？"
              onConfirm={handleRestartRos}
              okText="确定"
              cancelText="取消"
              placement="bottom"
              overlayClassName="ros-topic-manager-popconfirm"
            >
              <Button
                icon={<PoweroffOutlined />}
                title="一键重启ROS"
                className="ros-topic-manager-toolbar-btn restart-btn"
              />
            </Popconfirm>
            <div className={`ros-topic-manager-search-wrapper${searchOpen ? ' open' : ''}`}>
              <SearchOutlined
                className="ros-topic-manager-search-icon"
                onClick={() => setSearchOpen(!searchOpen)}
              />
              {searchOpen && (
                <Input
                  placeholder="搜索话题..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="ros-topic-manager-search-input"
                  onBlur={() => setSearchOpen(false)}
                  autoFocus
                />
              )}
            </div>
          </div>
          {/* 录制区域（内联显示） */}
          {recordMode && (
            <div className="ros-topic-manager-inline-record">
              <div className="ros-topic-manager-inline-record-path">
                <Input
                  placeholder="保存路径，如 /tmp/rosbag"
                  value={recordPath}
                  onChange={e => setRecordPath(e.target.value)}
                  className="ros-topic-manager-record-path-input"
                  style={{ width: 260 }}
                />
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectFolder} style={{ marginLeft: 8 }} />
              </div>
              <div className="ros-topic-manager-inline-record-actions">
                <Button
                  type="primary"
                  onClick={recordingStarted ? handleStopRecord : handleRecordConfirm}
                  style={{ marginRight: 12 }}
                  danger={isRecording}
                >
                  {isRecording ? (recordingStarted ? '停止录制' : '正在启动录制...') : '确认录制'}
                </Button>
                <Button onClick={handleRecordCancel}>取消</Button>
              </div>
            </div>
          )}
          {/* 话题列表 */}
          <div className="ros-topic-manager-list-wrapper">
            <List
              className="ros-topic-manager-list"
              dataSource={filteredTopics}
              renderItem={topic => (
                recordMode && !isRecording ? (
                  <List.Item className="ros-topic-manager-list-item">
                    <Checkbox
                      checked={recordSelectedTopics.includes(topic)}
                      onChange={e => {
                        if (e.target.checked) {
                          setRecordSelectedTopics([...recordSelectedTopics, topic]);
                        } else {
                          setRecordSelectedTopics(recordSelectedTopics.filter(t => t !== topic));
                        }
                      }}
                    >{topic}</Checkbox>
                  </List.Item>
                ) : (
                  <List.Item
                    onContextMenu={e => handleContextMenu(e, topic)}
                    onDoubleClick={() => viewTopicInfo(topic)}
                    className="ros-topic-manager-list-item"
                  >
                    {topic}
                  </List.Item>
                )
              )}
            />
          </div>

          {/* 右键菜单 */}
          {contextMenu && (
            <Menu
              style={{
                position: 'fixed',
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 1000,
                background: '#2d2d2d',
                border: '1px solid #444',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
              items={[
                {
                  key: 'view',
                  label: '查看',
                  style: { color: '#fff' },
                },
                {
                  key: 'copy',
                  label: '复制',
                  style: { color: '#fff' },
                }
              ]}
              onClick={handleMenuClick}
              onContextMenu={e => e.stopPropagation()}
            />
          )}
        </div>
      </Modal>
    </>
  );
};

export default RosTopicManager; 