import React, { useState, useEffect, useRef } from 'react';
import { Modal, message } from 'antd';
import CodeEditor from '../CodeEditor/CodeEditor';
import './FileEditor.css';
import { getFileType } from '../../assets/js/utils';
import FileController from '../../controller/gui/FileController';
import { log, LOG_TYPES } from '../../assets/js/utils';
import path from 'path';

const FileEditor = ({ visible, filePath, onClose }) => {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isModified, setIsModified] = useState(false);
  const lastSavedContent = useRef('');
  const lastSaveTime = useRef(0);

  // 加载文件内容
  useEffect(() => {
    if (visible && filePath) {
      try {
        const result = FileController.readFile(filePath);
        if (result.success) {
          setContent(result.content);
          lastSavedContent.current = result.content;
          setIsModified(false);
        } else {
          log(`读取文件失败: ${result.error}`, LOG_TYPES.ERROR);
        }
      } catch (error) {
        log(`读取文件失败: ${error.message}`, LOG_TYPES.ERROR);
      }
    }
  }, [visible, filePath]);

  // 处理内容变化
  const handleContentChange = (value) => {
    setContent(value);
    setIsModified(value !== lastSavedContent.current);
  };

  // 处理保存
  const handleSave = () => {
    const now = Date.now();
    if (now - lastSaveTime.current < 1000) {
      // message.warning('操作太快，请稍后再试');
      return;
    }
    lastSaveTime.current = now;
    try {
      const result = FileController.writeFile(filePath, content);
      if (result.success) {
        lastSavedContent.current = content;
        log(`保存文件成功: ${filePath}`, LOG_TYPES.SUCCESS);
        message.success('保存成功');
        setIsModified(true);
      } else {
        log(`保存文件失败: ${result.error}`, LOG_TYPES.ERROR);
        message.error(`保存失败: ${result.error}`);
      }
    } catch (error) {
      log(`保存文件失败: ${error.message}`, LOG_TYPES.ERROR);
      message.error(`保存失败: ${error.message}`);
    }
  };

  // 处理快捷键
  const handleKeyDown = (e) => {
    // Ctrl + S: 保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (isModified) handleSave();
    }
  };

  // 获取文件语言
  useEffect(() => {
    if (filePath) {
      const fileType = getFileType(filePath);
      if (fileType === 'code' || fileType === 'document') {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        setLanguage(ext);
      }
    }
  }, [filePath]);

  // 自定义标题栏
  const modalTitle = (
    <div className="file-editor-title-bar">
      <span className="file-editor-title">{filePath ? path.basename(filePath) : ''}</span>
      <button
        className={`save-button ${isModified ? 'modified' : ''}`}
        onClick={handleSave}
        disabled={!isModified}
        style={{ marginLeft: 'auto' }}
      >
        保存 (Ctrl+S)
      </button>
    </div>
  );

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={onClose}
      width="80%"
      style={{ top: 20 }}
      styles={{
        body: {
          height: 'calc(100vh - 200px)',
          padding: 0,
          backgroundColor: '#1e1e1e'
        },
        header: {
          backgroundColor: '#252526',
          borderBottom: '1px solid #333',
          padding: '12px 24px'
        },
        content: {
          backgroundColor: '#1e1e1e'
        }
      }}
      footer={null}
      className="file-editor-modal"
    >
      <div className="file-editor-container" onKeyDown={handleKeyDown}>
        <div className="file-editor-content">
          <CodeEditor
            value={content}
            language={language}
            onChange={handleContentChange}
          />
        </div>
      </div>
    </Modal>
  );
};

export default FileEditor; 