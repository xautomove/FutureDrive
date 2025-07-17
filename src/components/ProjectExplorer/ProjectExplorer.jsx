import React, { useState, useEffect } from 'react';
import { Tree, Card, Input, message, Modal } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';
import './ProjectExplorer.css';
import FileController from '../../controller/gui/FileController';
import { getFileType } from '../../assets/js/utils';
import FileEditor from '../FileEditor/FileEditor';

const path = window.require('path');
const fs = window.require('fs');

const ProjectExplorer = ({ treeData = [], projectName = '', onTreeDataChange }) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });
  const [renameInput, setRenameInput] = useState({ visible: false, node: null, value: '' });
  const [newItemInput, setNewItemInput] = useState({ visible: false, type: '', parentPath: '', value: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);

  const processTreeData = (data) => {
    return data.map(item => ({
      ...item,
      icon: item.children ? <FolderOutlined /> : null,
      children: item.children ? processTreeData(item.children) : undefined
    }));
  };

  const processedTreeData = processTreeData(treeData);

  const handleContextMenu = (e, node) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
      if (newItemInput.visible) {
        setNewItemInput({ visible: false, type: '', parentPath: '', value: '' });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [newItemInput.visible]);

  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除 "${contextMenu.node.title}" 吗？`,
        okText: '确定',
        cancelText: '取消',
        okButtonProps: {
          style: {
            background: '#1976d2',
            borderColor: '#1976d2'
          }
        },
        cancelButtonProps: {
          style: {
            background: '#3d3d3d',
            borderColor: '#444',
            color: '#e0e0e0'
          }
        },
        className: 'custom-modal',
        onOk: () => {
          const result = FileController.deleteFile(contextMenu.node.key);
          if (result.success) {
            message.success('删除成功');
            onTreeDataChange && onTreeDataChange();
          } else {
            message.error(result.error);
          }
        }
      });
    }
    closeContextMenu();
  };

  const handleRename = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      Modal.confirm({
        title: '确认重命名',
        content: `确定要重命名 "${contextMenu.node.title}" 吗？`,
        okText: '确定',
        cancelText: '取消',
        okButtonProps: {
          style: {
            background: '#1976d2',
            borderColor: '#1976d2'
          }
        },
        cancelButtonProps: {
          style: {
            background: '#3d3d3d',
            borderColor: '#444',
            color: '#e0e0e0'
          }
        },
        className: 'custom-modal',
        onOk: () => {
          setRenameInput({
            visible: true,
            node: contextMenu.node,
            value: contextMenu.node.title
          });
        }
      });
    }
    closeContextMenu();
  };

  const handleOpenInExplorer = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      const result = FileController.openInExplorer(contextMenu.node.key);
      if (!result.success) {
        message.error(result.error);
      }
    }
    closeContextMenu();
  };

  const handleNewFile = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      const parentPath = contextMenu.node.key;
      setNewItemInput({
        visible: true,
        type: 'file',
        parentPath,
        value: ''
      });
    }
    closeContextMenu();
  };

  const handleNewFolder = (e) => {
    e.stopPropagation();
    if (contextMenu.node) {
      const parentPath = contextMenu.node.key;
      setNewItemInput({
        visible: true,
        type: 'folder',
        parentPath,
        value: ''
      });
    }
    closeContextMenu();
  };
  
  const handleNewItemInputChange = (e) => {
    setNewItemInput(prev => ({
      ...prev,
      value: e.target.value
    }));
  };

  const handleNewItemConfirm = () => {
    if (newItemInput.value) {
      const newPath = path.join(newItemInput.parentPath, newItemInput.value);
      const result = newItemInput.type === 'file' 
        ? FileController.createFile(newPath)
        : FileController.createFolder(newPath);
      
      if (result.success) {
        message.success(`新建${newItemInput.type === 'file' ? '文件' : '文件夹'}成功`);
        onTreeDataChange && onTreeDataChange();
      } else {
        message.error(result.error);
      }
    }
    setNewItemInput({ visible: false, type: '', parentPath: '', value: '' });
  };

  const handleNewItemCancel = () => {
    setNewItemInput({ visible: false, type: '', parentPath: '', value: '' });
  };

  const handleNewItemKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNewItemConfirm();
    } else if (e.key === 'Escape') {
      handleNewItemCancel();
    }
  };

  const handleRenameInputChange = (e) => {
    setRenameInput(prev => ({
      ...prev,
      value: e.target.value
    }));
  };

  const handleRenameConfirm = () => {
    if (renameInput.node && renameInput.value !== renameInput.node.title) {
      const oldPath = renameInput.node.key;
      const newPath = oldPath.replace(renameInput.node.title, renameInput.value);
      const result = FileController.renameFile(oldPath, newPath);
      if (result.success) {
        message.success('重命名成功');
        onTreeDataChange && onTreeDataChange();
      } else {
        message.error(result.error);
      }
    }
    setRenameInput({ visible: false, node: null, value: '' });
  };

  const handleRenameCancel = () => {
    setRenameInput({ visible: false, node: null, value: '' });
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleDoubleClick = (node) => {
    try {
      const stats = fs.statSync(node.key);
      if (stats.isDirectory()) {
        const key = node.key;
        setExpandedKeys(prev => {
          if (prev.includes(key)) {
            return prev.filter(k => k !== key);
          } else {
            return [...prev, key];
          }
        });
      } else {
        const fileType = getFileType(node.key);
        if (fileType === 'code' || fileType === 'document') {
          setSelectedFile(node.key);
          setEditorVisible(true);
        }
      }
    } catch (error) {
      console.error('获取文件信息失败:', error);
    }
  };

  const renderTreeNode = (node) => {
    if (renameInput.visible && renameInput.node?.key === node.key) {
      return (
        <div className="tree-node-input">
          <Input
            size="small"
            value={renameInput.value}
            onChange={handleRenameInputChange}
            onBlur={handleRenameConfirm}
            onKeyDown={handleRenameKeyDown}
            autoFocus
          />
        </div>
      );
    }
    if (newItemInput.visible && newItemInput.parentPath === node.key) {
      return (
        <>
          <span>{node.title}</span>
          <div className="tree-node-input">
            <Input
              size="small"
              value={newItemInput.value}
              onChange={handleNewItemInputChange}
              onBlur={handleNewItemConfirm}
              onKeyDown={handleNewItemKeyDown}
              autoFocus
              placeholder={`新建${newItemInput.type === 'file' ? '文件' : '文件夹'}`}
            />
          </div>
        </>
      );
    }
    return node.title;
  };

  if (!projectName) {
    return null;
  }

  return (
    <div className="project-explorer">
      <div className="console-header">
        <div className="console-title">{projectName}</div>
      </div>
      <div className="console-content">
      <Tree
          treeData={processedTreeData}
          defaultExpandAll={false}
        showIcon
          blockNode
          selectable
          indent={24}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          onRightClick={({ node, event }) => handleContextMenu(event, node)}
          onDoubleClick={(_, node) => handleDoubleClick(node)}
          titleRender={renderTreeNode}
        />
      </div>
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
          }}
        >
          <div 
            className="context-menu-item"
            onClick={handleNewFile}
          >
            新建文件
          </div>
          <div 
            className="context-menu-item"
            onClick={handleNewFolder}
          >
            新建文件夹
          </div>
          <div 
            className="context-menu-item"
            onClick={handleRename}
          >
            重命名
          </div>
          <div 
            className="context-menu-item"
            onClick={handleDelete}
          >
            删除
          </div>
          <div 
            className="context-menu-item"
            onClick={handleOpenInExplorer}
          >
            在资源管理器中打开
          </div>
        </div>
      )}
      <FileEditor
        visible={editorVisible}
        filePath={selectedFile}
        onClose={() => {
          setEditorVisible(false);
          setSelectedFile(null);
        }}
      />
    </div>
  );
};

export default ProjectExplorer; 