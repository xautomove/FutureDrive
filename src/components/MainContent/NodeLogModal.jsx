import React from 'react';
import { Modal, Tabs, Button, Empty } from 'antd';
import GLOBALS from '../../assets/js/globals';

const NodeLogModal = ({ visible, onClose, uuid }) => {
  const logs = GLOBALS.nodeLogs || [];
  const log = logs.find(item => item.uuid === uuid);

  if (!uuid || !log) {
    return (
      <Modal 
        open={visible} 
        onCancel={onClose} 
        footer={null} 
        title="节点运行日志" 
        width={700} 
        className="maincontent-log-modal"
        styles={{
          body: { maxHeight: 'calc(80vh - 110px)', overflow: 'hidden' },
          content: { backgroundColor: '#2d2d2d' },
          header: { backgroundColor: '#2d2d2d', borderBottom: '1px solid #444' }
        }}
      >
        <Empty description="暂无该节点运行记录" />
        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button onClick={onClose}>关闭</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal 
      open={visible} 
      onCancel={onClose} 
      footer={null} 
      title="节点运行日志" 
      width={700} 
      className="maincontent-log-modal"
      styles={{
        body: { maxHeight: 'calc(80vh - 110px)', overflow: 'hidden' },
        content: { backgroundColor: '#2d2d2d' },
        header: { backgroundColor: '#2d2d2d', borderBottom: '1px solid #444' }
      }}
    >
      <Tabs
        defaultActiveKey="input"
      >
        <Tabs.TabPane tab="运行状态" key="status">
          <div style={{ 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: 16,
            borderRadius: 6,
            border: '1px solid #333',
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0
          }}>
            <div style={{ marginBottom: 12 }}>
              <strong>状态:</strong> 
              <span style={{ 
                color: log?.error ? '#ff4d4f' : '#52c41a',
                marginLeft: 8,
                padding: '2px 8px',
                background: log?.error ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)',
                borderRadius: 4,
                border: `1px solid ${log?.error ? '#ff4d4f' : '#52c41a'}`
              }}>
                {log?.status === 'completed' ? '已完成' : log?.status === 'error' ? '执行错误' : '未知状态'}
              </span>
            </div>
            {log?.startTime && (
              <div style={{ marginBottom: 8 }}>
                <strong>开始时间:</strong> <span style={{ marginLeft: 8 }}>{log.startTime}</span>
              </div>
            )}
            {log?.endTime && (
              <div style={{ marginBottom: 8 }}>
                <strong>结束时间:</strong> <span style={{ marginLeft: 8 }}>{log.endTime}</span>
              </div>
            )}
            {log?.duration && (
              <div style={{ marginBottom: 8 }}>
                <strong>运行时长:</strong> <span style={{ marginLeft: 8, color: '#1890ff' }}>{log.duration}</span>
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <strong>节点名称:</strong> <span style={{ marginLeft: 8 }}>{log?.label || '未知'}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>UUID:</strong> <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11 }}>{log?.uuid || '未知'}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>记录时间:</strong> <span style={{ marginLeft: 8 }}>{log?.time || '未知'}</span>
            </div>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab="输入信息" key="input">
          <pre style={{ 
            maxHeight: 400, 
            overflow: 'auto', 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: 16,
            borderRadius: 6,
            border: '1px solid #333',
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0
          }}>{log?.input ? JSON.stringify(log.input, null, 2) : '无'}</pre>
        </Tabs.TabPane>
        <Tabs.TabPane tab="输出信息" key="output">
          <pre style={{ 
            maxHeight: 400, 
            overflow: 'auto', 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: 16,
            borderRadius: 6,
            border: '1px solid #333',
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0
          }}>{log?.output ? JSON.stringify(log.output, null, 2) : '无'}</pre>
        </Tabs.TabPane>
        <Tabs.TabPane tab="用户配置" key="config">
          <pre style={{ 
            maxHeight: 400, 
            overflow: 'auto', 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: 16,
            borderRadius: 6,
            border: '1px solid #333',
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0
          }}>{log?.config ? JSON.stringify(log.config, null, 2) : '无'}</pre>
        </Tabs.TabPane>
        <Tabs.TabPane tab="调试信息" key="debug">
          <pre style={{ 
            maxHeight: 400, 
            overflow: 'auto', 
            background: '#1e1e1e', 
            color: '#d4d4d4', 
            padding: 16,
            borderRadius: 6,
            border: '1px solid #333',
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0
          }}>{log?.debug || '无'}</pre>
        </Tabs.TabPane>
      </Tabs>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onClose}>关闭</Button>
      </div>
    </Modal>
  );
};

export default NodeLogModal; 