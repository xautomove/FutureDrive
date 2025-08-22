import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, List, Menu, message, Checkbox, Popconfirm } from 'antd';
import { SearchOutlined, ReloadOutlined, VideoCameraOutlined, FolderOpenOutlined, PoweroffOutlined, PlayCircleOutlined } from '@ant-design/icons';
import './RosTopicManager.css';
import rosController from '../../controller/ros/RosController';
import commandExecutor from '../../assets/js/commandExecutor';
import path from 'path';
import { log, LOG_TYPES } from '../../assets/js/utils';
import windowController from '../../controller/gui/WindowController';
import { useI18n } from '../../context/I18nContext';

const RosTopicManager = ({ visible, onClose }) => {
  const { t } = useI18n();
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
      message.error(t('rostopic.fetchFailed', { msg: error.message }));
    }
  };

  const copyTopicName = (topic) => {
    navigator.clipboard.writeText(topic).then(
      () => message.success(t('rostopic.copySuccess')),
      () => message.error(t('rostopic.copyFailed'))
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
      message.warning(t('rostopic.choosePathWarn'));
      return;
    }
    if (!recordSelectedTopics.length) {
      message.warning(t('rostopic.chooseTopicWarn'));
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
            message.success(t('rostopic.recordingStarted'));
          }
        },
        onStderr: (text) => {
          if (text.includes('[ERROR]') || text.includes('error') || text.includes('Error')) {
            log(text, LOG_TYPES.ERROR);
            if (text.includes("Output folder '") && text.includes("' already exists.")) {
              const match = text.match(/Output folder '(.+)' already exists\./);
              if (match && match[1]) {
                message.error(t('rostopic.fileExists', { path: match[1] }));
              } else {
                message.error(t('rostopic.fileExistsGeneric'));
              }
            }
          } else {
            if (text.includes('Recording...')) {
              setRecordingStarted(true);
              setIsRecording(true);
              message.success(t('rostopic.recordingStarted'));
            } else if (text.includes('Recording stopped')) {
              message.success(t('rostopic.recordStop'));
            }
          }
        },
      });
      recordProcessRef.current = proc;
      log(`启动录制进程: ${recordPath}`, LOG_TYPES.SUCCESS);
    } catch (e) {
      message.error(t('rostopic.recordStartFailed', { msg: e.message }));
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
      message.error(t('rostopic.selectDirFailed', { msg: error.message }));
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
        message.warning(t('rostopic.daemonStartFailed', { msg: error.message }));
      }
      message.success(t('rostopic.restartSuccess'));

      setTimeout(() => {
        fetchTopics();
      }, 2000);

    } catch (error) {
      message.error(t('rostopic.restartFailed', { msg: error.message }));
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
        message.error(t('rostopic.stopRecordFailed'));
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
        title={t('rostopic.modalTitle')}
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
              title={t('rostopic.refreshTitle')}
              className="ros-topic-manager-toolbar-btn"
            />
            <Button
              icon={<VideoCameraOutlined />}
              onClick={handleRecordClick}
              title={t('rostopic.recordTitle')}
              className="ros-topic-manager-toolbar-btn"
            />
            <Button
              icon={<PlayCircleOutlined />}
              onClick={handlePlayClick}
              title={t('rostopic.playbackTitle')}
              className="ros-topic-manager-toolbar-btn play-btn"
            />
            <Popconfirm
              title={t('rostopic.restartTitle')}
              description={t('rostopic.restartDesc')}
              onConfirm={handleRestartRos}
              okText={t('common.ok')}
              cancelText={t('common.cancel')}
              placement="bottom"
              overlayClassName="ros-topic-manager-popconfirm"
            >
              <Button
                icon={<PoweroffOutlined />}
                title={t('rostopic.restartBtnTitle')}
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
                  placeholder={t('rostopic.searchPlaceholder')}
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
                  placeholder={t('rostopic.savePathPlaceholder')}
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
                  {isRecording ? (recordingStarted ? t('rostopic.recordStop') : t('rostopic.recordingStarting')) : t('rostopic.recordConfirm')}
                </Button>
                <Button onClick={handleRecordCancel}>{t('rostopic.cancel')}</Button>
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
                  label: t('rostopic.contextView'),
                  style: { color: '#fff' },
                },
                {
                  key: 'copy',
                  label: t('rostopic.contextCopy'),
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