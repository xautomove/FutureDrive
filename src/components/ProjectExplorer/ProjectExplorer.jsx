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

  // 处理树形数据，只有文件夹显示图标
  const processTreeData = (data) => {
    return data.map(item => ({
      ...item,
      icon: item.children ? <FolderOutlined /> : null,
      children: item.children ? processTreeData(item.children) : undefined
    }));
  };

  const processedTreeData = processTreeData(treeData);

  // 处理右键菜单
  const handleContextMenu = (e, node) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // 点击其他地方时关闭右键菜单
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

  // 处理展开/折叠
  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  // 删除文件
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

  // 重命名文件
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

  // 在资源管理器中打开
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

  // 新建文件
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

  // 新建文件夹
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

  // 处理新建项目输入
  const handleNewItemInputChange = (e) => {
    setNewItemInput(prev => ({
      ...prev,
      value: e.target.value
    }));
  };

  // 处理新建项目确认
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

  // 处理新建项目取消
  const handleNewItemCancel = () => {
    setNewItemInput({ visible: false, type: '', parentPath: '', value: '' });
  };

  // 处理新建项目按键事件
  const handleNewItemKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNewItemConfirm();
    } else if (e.key === 'Escape') {
      handleNewItemCancel();
    }
  };

  // 处理重命名输入
  const handleRenameInputChange = (e) => {
    setRenameInput(prev => ({
      ...prev,
      value: e.target.value
    }));
  };

  // 处理重命名确认
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

  // 处理重命名取消
  const handleRenameCancel = () => {
    setRenameInput({ visible: false, node: null, value: '' });
  };

  // 处理重命名按键事件
  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  // 处理双击事件
  const handleDoubleClick = (node) => {
    try {
      const stats = fs.statSync(node.key);
      if (stats.isDirectory()) {
        // 如果是文件夹，切换展开/折叠状态
        const key = node.key;
        setExpandedKeys(prev => {
          if (prev.includes(key)) {
            return prev.filter(k => k !== key);
          } else {
            return [...prev, key];
          }
        });
      } else {
        // 如果是文件，检查是否支持编辑
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

  // 自定义渲染树节点
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