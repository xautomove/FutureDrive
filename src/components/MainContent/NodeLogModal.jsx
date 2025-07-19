import React from 'react';
import { Modal, Tabs, Button, Empty, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import GLOBALS from '../../assets/js/globals';

const NodeLogModal = ({ visible, onClose, uuid }) => {
  const logs = GLOBALS.nodeLogs || [];
  const log = logs.find(item => item.uuid === uuid);

  const handleCopy = (content) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        message.success('复制成功');
      }).catch(() => {
        message.error('复制失败');
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        message.success('复制成功');
      } catch (err) {
        message.error('复制失败');
      }
      document.body.removeChild(textArea);
    }
  };

  const renderContentWithCopy = (content, title) => {
    const displayContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content || '无';
    
    return (
      <div style={{ position: 'relative' }}>
        <Button
          type="text"
          icon={<CopyOutlined />}
          size="small"
          onClick={() => handleCopy(displayContent)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            color: '#d4d4d4',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid #444'
          }}
          title={`复制${title}`}
        />
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
        }}>{displayContent}</pre>
      </div>
    );
  };

  const renderStatusWithCopy = () => {
    const statusContent = `状态: ${log?.status === 'completed' ? '已完成' : log?.status === 'error' ? '执行错误' : '未知状态'}
开始时间: ${log?.startTime || '未知'}
结束时间: ${log?.endTime || '未知'}
运行时长: ${log?.duration || '未知'}
节点名称: ${log?.label || '未知'}
UUID: ${log?.uuid || '未知'}
记录时间: ${log?.time || '未知'}`;

    return (
      <div style={{ position: 'relative' }}>
        <Button
          type="text"
          icon={<CopyOutlined />}
          size="small"
          onClick={() => handleCopy(statusContent)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            color: '#d4d4d4',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid #444'
          }}
          title="复制状态信息"
        />
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
      </div>
    );
  };

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
          {renderStatusWithCopy()}
        </Tabs.TabPane>
        <Tabs.TabPane tab="输入信息" key="input">
          {renderContentWithCopy(log?.input, '输入信息')}
        </Tabs.TabPane>
        <Tabs.TabPane tab="输出信息" key="output">
          {renderContentWithCopy(log?.output, '输出信息')}
        </Tabs.TabPane>
        <Tabs.TabPane tab="用户配置" key="config">
          {renderContentWithCopy(log?.config, '用户配置')}
        </Tabs.TabPane>
        <Tabs.TabPane tab="调试信息" key="debug">
          {renderContentWithCopy(log?.debug, '调试信息')}
        </Tabs.TabPane>
      </Tabs>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onClose}>关闭</Button>
      </div>
    </Modal>
  );
};

export default NodeLogModal; 