import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, List, Menu, message, Checkbox } from 'antd';
import { SearchOutlined, ReloadOutlined, VideoCameraOutlined, StopOutlined, FolderOpenOutlined } from '@ant-design/icons';
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
  // 录制相关
  const [recordMode, setRecordMode] = useState(false);
  const [recordSelectedTopics, setRecordSelectedTopics] = useState([]);
  const [recordPath, setRecordPath] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recordProcessRef = useRef(null);

  // 获取话题列表
  const fetchTopics = async () => {
    try {
      const topicList = await rosController.getTopicList();
      setTopics(topicList);
    } catch (error) {
      message.error(`获取话题列表失败: ${error.message}`);
    }
  };

  // 复制话题名称到剪贴板
  const copyTopicName = (topic) => {
    navigator.clipboard.writeText(topic).then(
      () => message.success('话题名称已复制到剪贴板'),
      () => message.error('复制失败')
    );
  };

  // 查看话题详情（多窗口弹出，主窗口负责进程和数据推送）
  const viewTopicInfo = (topic) => {
    windowController.openViewer(800, 600, 'show_topic', { topic });
  };

  // 处理右键菜单
  const handleContextMenu = (event, topic) => {
    event.preventDefault();
    setSelectedTopic(topic);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  };

  // 处理菜单点击
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

  // 过滤话题列表
  const filteredTopics = topics.filter(topic =>
    topic.toLowerCase().includes(searchText.toLowerCase())
  );

  // 组件加载时获取话题列表
  useEffect(() => {
    if (visible) {
      fetchTopics();
    }
  }, [visible]);

  // 录制按钮点击
  const handleRecordClick = () => {
    if (isRecording) {
      // 停止录制
      if (recordProcessRef.current) {
        try {
          recordProcessRef.current.kill('SIGINT');
          setIsRecording(false);
          message.success('录制已停止');
        } catch (e) {
          message.error('停止录制失败');
        }
      }
    } else {
      setRecordMode(true);
    }
  };

  // 录制面板确认
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
      const proc = commandExecutor.execute(cmd, args, {
        onStdout: (text) => message.info(text),
        onStderr: (text) => message.error(text),
      });
      recordProcessRef.current = (await proc).child;
      setIsRecording(true);
      setRecordMode(false);
      message.success('开始录制');
      log(`开始录制: ${recordPath}`, LOG_TYPES.SUCCESS);
    } catch (e) {
      message.error('录制启动失败: ' + e.message);
      log(`录制启动失败: ${e.message}`, LOG_TYPES.ERROR);
    }
  };

  // 录制面板取消
  const handleRecordCancel = () => {
    setRecordMode(false);
    setRecordSelectedTopics([]);
    setRecordPath('');
  };

  // 选择文件夹（可用 Electron 的 dialog，示例为简单输入）
  const handleSelectFolder = async () => {
    try {
      const { dialog } = window.require('@electron/remote');
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (!result.canceled && result.filePaths && result.filePaths[0]) {
        const date = new Date();
        const timestamp = `${date.getMonth() + 1}${date.getDate()}_${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
        const bagFileName = `rosbag_${timestamp}.bag`;
        const bagFilePath = path.join(result.filePaths[0], bagFileName);
        setRecordPath(bagFilePath);
      }
    } catch (error) {
      message.error('选择目录失败：' + error.message);
    }
  };

  return (
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
            icon={isRecording ? <StopOutlined /> : <VideoCameraOutlined />}
            onClick={handleRecordClick}
            title={isRecording ? '停止录制' : '录制'}
            className={`ros-topic-manager-toolbar-btn${isRecording ? ' recording' : ''}`}
            danger={isRecording}
          />
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
        {recordMode && !isRecording && (
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
              <Button type="primary" onClick={handleRecordConfirm} style={{ marginRight: 12 }}>确认录制</Button>
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
  );
};

export default RosTopicManager; 