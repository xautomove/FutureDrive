import React from 'react';
import { Modal, Tabs, Button, Empty, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import GLOBALS from '../../assets/js/globals';
import { useI18n } from '../../context/I18nContext';

const NodeLogModal = ({ visible, onClose, uuid }) => {
  const { t } = useI18n();
  const logs = GLOBALS.nodeLogs || [];
  const log = logs.find(item => item.uuid === uuid);

  const handleCopy = (content) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        message.success(t('nodeLog.copySuccess'));
      }).catch(() => {
        message.error(t('nodeLog.copyFailed'));
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        message.success(t('nodeLog.copySuccess'));
      } catch (err) {
        message.error(t('nodeLog.copyFailed'));
      }
      document.body.removeChild(textArea);
    }
  };

  const renderContentWithCopy = (content) => {
    const displayContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content || t('nodeLog.none');
    
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
          title={t('nodeLog.copyStatusTitle')}
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
    const statusText = log?.status === 'completed' ? t('nodeLog.statusCompleted') : log?.status === 'error' ? t('nodeLog.statusError') : t('nodeLog.statusUnknown');
    const statusContent = `${t('nodeLog.status')} ${statusText}
${t('nodeLog.startTime')} ${log?.startTime || t('nodeLog.statusUnknown')}
${t('nodeLog.endTime')} ${log?.endTime || t('nodeLog.statusUnknown')}
${t('nodeLog.duration')} ${log?.duration || t('nodeLog.statusUnknown')}
${t('nodeLog.nodeName')} ${log?.label || t('nodeLog.statusUnknown')}
${t('nodeLog.uuid')} ${log?.uuid || t('nodeLog.statusUnknown')}
${t('nodeLog.recordTime')} ${log?.time || t('nodeLog.statusUnknown')}`;

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
          title={t('nodeLog.copyStatusTitle')}
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
            <strong>{t('nodeLog.status')}</strong> 
            <span style={{ 
              color: log?.error ? '#ff4d4f' : '#52c41a',
              marginLeft: 8,
              padding: '2px 8px',
              background: log?.error ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)',
              borderRadius: 4,
              border: `1px solid ${log?.error ? '#ff4d4f' : '#52c41a'}`
            }}>
              {log?.status === 'completed' ? t('nodeLog.statusCompleted') : log?.status === 'error' ? t('nodeLog.statusError') : t('nodeLog.statusUnknown')}
            </span>
          </div>
          {log?.startTime && (
            <div style={{ marginBottom: 8 }}>
              <strong>{t('nodeLog.startTime')}</strong> <span style={{ marginLeft: 8 }}>{log.startTime}</span>
            </div>
          )}
          {log?.endTime && (
            <div style={{ marginBottom: 8 }}>
              <strong>{t('nodeLog.endTime')}</strong> <span style={{ marginLeft: 8 }}>{log.endTime}</span>
            </div>
          )}
          {log?.duration && (
            <div style={{ marginBottom: 8 }}>
              <strong>{t('nodeLog.duration')}</strong> <span style={{ marginLeft: 8, color: '#1890ff' }}>{log.duration}</span>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <strong>{t('nodeLog.nodeName')}</strong> <span style={{ marginLeft: 8 }}>{log?.label || t('nodeLog.statusUnknown')}</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>{t('nodeLog.uuid')}</strong> <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11 }}>{log?.uuid || t('nodeLog.statusUnknown')}</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>{t('nodeLog.recordTime')}</strong> <span style={{ marginLeft: 8 }}>{log?.time || t('nodeLog.statusUnknown')}</span>
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
        title={t('nodeLog.title')} 
        width={700} 
        className="maincontent-log-modal"
        styles={{
          body: { maxHeight: 'calc(80vh - 110px)', overflow: 'hidden' },
          content: { backgroundColor: '#2d2d2d' },
          header: { backgroundColor: '#2d2d2d', borderBottom: '1px solid #444' }
        }}
      >
        <Empty description={t('nodeLog.empty')} />
        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button onClick={onClose}>{t('nodeLog.close')}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal 
      open={visible} 
      onCancel={onClose} 
      footer={null} 
      title={t('nodeLog.title')} 
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
        <Tabs.TabPane tab={t('nodeLog.tabs.status')} key="status">
          {renderStatusWithCopy()}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nodeLog.tabs.input')} key="input">
          {renderContentWithCopy(log?.input)}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nodeLog.tabs.output')} key="output">
          {renderContentWithCopy(log?.output)}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nodeLog.tabs.config')} key="config">
          {renderContentWithCopy(log?.config)}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nodeLog.tabs.debug')} key="debug">
          {renderContentWithCopy(log?.debug)}
        </Tabs.TabPane>
      </Tabs>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onClose}>{t('nodeLog.close')}</Button>
      </div>
    </Modal>
  );
};

export default NodeLogModal; 