import React, { useEffect, useState } from 'react';
import { Controls } from 'reactflow';
import NodeScanner from '../../controller/node/NodeScanner';
import NodeListModal from '../NodeListModal/NodeListModal';

/**
 * NodeButton 组件
 * 功能：
 * 1. 在控制面板添加一个节点列表按钮
 * 2. 点击按钮显示节点列表模态框
 * 3. 处理节点选择事件
 */
const NodeButton = ({ onNodeSelect }) => {
  // 状态管理
  const [isModalOpen, setIsModalOpen] = useState(false);  // 控制模态框显示/隐藏
  const [nodeList, setNodeList] = useState([]);  // 存储扫描到的节点列表

  // 初始化时扫描可用节点
  useEffect(() => {
    try {
      const scanner = new NodeScanner();
      const scannedNodes = scanner.scanNodes();
      setNodeList(scannedNodes);
    } catch (error) {
      console.error('节点扫描失败:', error);
    }
  }, []);

  // 在控制面板添加节点列表按钮
  useEffect(() => {
    // 使用 setTimeout 确保 DOM 完全加载
    const timer = setTimeout(() => {
      const panel = document.querySelector('.react-flow__panel');
      if (panel) {
        // 创建按钮元素
        const button = document.createElement('button');
        button.className = 'react-flow__controls-button react-flow__controls-interactive';
        button.type = 'button';
        button.title = '节点列表';
        button.setAttribute('aria-label', '节点列表');
        
        // 绑定点击事件：打开节点列表模态框
        button.onclick = () => {
          setIsModalOpen(true);
        };

        // 创建按钮图标
        const icon = document.createElement('div');
        icon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000" class="size-6">
            <path fill-rule="evenodd" d="M3 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 5.25Zm0 4.5A.75.75 0 0 1 3.75 9h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 9.75Zm0 4.5a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
          </svg>`;
        button.appendChild(icon);

        // 将按钮添加到控制面板
        panel.appendChild(button);
      }
    }, 100);

    // 组件卸载时清理
    return () => {
      clearTimeout(timer);
      const button = document.querySelector('.react-flow__controls-button');
      if (button) {
        button.remove();
      }
    };
  }, []);

  return (
    <div className="react-flow__controls">
      <Controls />
      {/* 节点列表模态框 */}
      <NodeListModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        nodes={nodeList}
        onNodeSelect={(node) => {
          if (node.type === 'refresh') {
            // 处理刷新事件
            setNodeList(node.nodes);
          } else {
            // 处理节点选择事件
            onNodeSelect(node);
            setIsModalOpen(false);
          }
        }}
      />
    </div>
  );
};

export default NodeButton; 