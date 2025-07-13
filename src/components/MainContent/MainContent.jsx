import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
  NodeToolbar,
} from 'reactflow';
import { Menu, Modal, Input } from 'antd';
import 'reactflow/dist/style.css';
import './MainContent.css';
import NodeListModal from '../NodeListModal/NodeListModal';
import NodeButton from './NodeButton';
import { log, LOG_TYPES } from '../../assets/js/utils';
import NodeConfigModal from '../NodeConfigModal/NodeConfigModal';
import guiController from '../../controller/gui/GuiController';
import createExampleNode from '../../assets/js/createExampleNode';
import GLOBALS from '../../assets/js/globals';
import TemplateManager from '../TemplateManager/TemplateManager';
import templateManager from '../../controller/gui/TemplateManager';
import FileController from '../../controller/gui/FileController';
import path from 'path';
import { ChromePicker } from 'react-color';
import ReactDOM from 'react-dom';

/**
 * 自定义节点组件
 * 用于显示节点的输入输出端口和删除按钮
 */
const CustomNode = ({ data, selected, id, onDelete, onOpenConfig, onColorChange }) => {
  const [showDescription, setShowDescription] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({ left: 0, top: 0 });

  // 监听节点运行状态
  useEffect(() => {
    const unsubscribe = GLOBALS.onRunningNodesChange((runningNodes) => {
      // 检查当前节点是否在运行列表中
      setIsRunning(runningNodes.includes(id));
    });
    return () => unsubscribe();
  }, [id]);

  const handleColorBtnClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setColorPickerPos({ left: rect.left, top: rect.bottom + 4 });
    setShowColorPicker(v => !v);
  };

  return (
    <div className="custom-node-wrapper">
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={10}
        align="center"
      >
        <div className="node-toolbar-floating">
          {/* 设置图标 */}
          <button className="node-toolbar-btn" title="设置" onClick={() => onOpenConfig(id)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.5" fill="none" />
              <path d="M8 5.5V8L10 9" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          {/* 调色板图标 */}
          <button className="node-toolbar-btn" title="设置颜色" onClick={handleColorBtnClick}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.5" fill="none" />
              <circle cx="6" cy="7" r="1" fill="#1976d2" />
              <circle cx="10" cy="7" r="1" fill="#43a047" />
              <circle cx="8" cy="10" r="1" fill="#fbc02d" />
            </svg>
          </button>
          {showColorPicker && ReactDOM.createPortal(
            <div style={{ position: 'fixed', left: colorPickerPos.left, top: colorPickerPos.top, zIndex: 9999 }}>
              <ChromePicker
                color={data.color || '#2d2d2d'}
                onChange={color => onColorChange(id, color.hex)}
                disableAlpha
              />
              <button
                style={{ marginTop: 8, width: '100%' }}
                onClick={() => setShowColorPicker(false)}
              >关闭</button>
            </div>,
            document.body
          )}
          {/* 删除图标 */}
          <button className="node-toolbar-btn" title="删除节点" onClick={() => onDelete(id)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="6" width="10" height="7" rx="1" fill="#fff" fillOpacity="0.8" />
              <rect x="6" y="2" width="4" height="2" rx="1" fill="#fff" fillOpacity="0.8" />
              <rect x="2" y="4" width="12" height="2" rx="1" fill="#fff" fillOpacity="0.8" />
              <rect x="7" y="8" width="2" height="3" rx="1" fill="#888" />
            </svg>
          </button>
        </div>
      </NodeToolbar>
      <div className={`custom-node${isRunning ? ' running' : ''}`} style={{ background: data.color || '#2d2d2d' }}>
        <div
          className="node-title"
          style={{
            position: 'relative',
            borderBottom: (data.inputs?.length > 0 || data.outputs?.length > 0) ? '1px solid #444' : 'none'
          }}
          onMouseEnter={() => setShowDescription(true)}
          onMouseLeave={() => setShowDescription(false)}
        >
          {data.label}
          {showDescription && data.description && (
            <div className="node-description-tip">
              {data.description}
            </div>
          )}
        </div>
        <div className={`node-content${data.inputs?.length > 0 ? '' : ' no-inputs'}`}>
          <div className="node-inputs">
            {data.inputs?.map((input, index) => (
              <div key={`input-${index}`} className="port">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`input-${index}`}
                  style={{ top: `${(index + 1) * 30}px` }}
                  isConnectable={true}
                />
                <div className="port-label" style={{ position: 'relative' }}>
                  <span className="port-name">{input.name}</span>
                  <div className="port-info">
                    <span className="port-type">{input.type}</span>
                    {input.default_value !== undefined && (
                      <span className="port-default-value" title={`默认值: ${input.default_value}`}>
                        {input.default_value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.inputs?.length > 0 && <div className="divider" />}

          <div className="node-outputs">
            {data.outputs?.map((output, index) => (
              <div key={`output-${index}`} className="port">
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output-${index}`}
                  style={{ top: `${(index + 1) * 30}px` }}
                  isConnectable={true}
                />
                <div className="port-label" style={{ position: 'relative' }}>
                  <span className="port-name">{output.name}</span>
                  <div className="port-info">
                    <span className="port-type">{output.type}</span>
                    {output.default_value !== undefined && (
                      <span className="port-default-value" title={`默认值: ${output.default_value}`}>
                        {output.default_value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * MainContent 组件
 * 功能：
 * 1. 渲染 ReactFlow 画布
 * 2. 管理节点和边的状态
 * 3. 处理节点添加和更新
 * 4. 提供画布控制功能（缩放、平移等）
 * 
 * 数据流：
 * 1. 用户点击节点列表按钮 -> 打开节点列表模态框
 * 2. 用户选择节点 -> 触发 handleNodeSelect
 * 3. 创建新节点 -> 添加到画布
 * 4. 用户操作节点/边 -> 触发 onNodesChange/onEdgesChange
 */
const NODE_WIDTH = 220; // 估算节点宽度
const NODE_HEIGHT = 120; // 估算节点高度
const NODE_OFFSET = 40; // 每次偏移量

const MainContent = ({ onTreeDataChange }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nodeList, setNodeList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configNode, setConfigNode] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isTemplateManagerVisible, setIsTemplateManagerVisible] = useState(false);

  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
    // 将nodes和edges暴露到全局
    window.flowNodes = nodes;
    window.flowEdges = edges;
  }, [nodes, edges]);

  // 监听运行状态
  useEffect(() => {
    // 订阅状态变化
    const unsubscribe = GLOBALS.onRunningStateChange((newState) => {
      setIsRunning(newState);
    });

    // 清理订阅
    return () => unsubscribe();
  }, []);

  const handleRunStop = async () => {
    if (isRunning) {
      try {
        if (typeof GLOBALS.nodeController.forceStop === 'function') {
          await GLOBALS.nodeController.forceStop();
        } else {
          await GLOBALS.nodeController.stop();
        }
        log('流程已强制停止', LOG_TYPES.INFO);
      } catch (error) {
        log(`停止流程失败：${error.message}`, LOG_TYPES.ERROR);
      }
    } else {
      try {
        const nodes = window.flowNodes || [];
        const edges = window.flowEdges || [];

        if (nodes.length === 0) {
          log('没有可执行的节点', LOG_TYPES.WARNING);
          return;
        }

        log('开始执行流程...', LOG_TYPES.INFO);
        await GLOBALS.nodeController.start(nodes, edges);
        log('流程执行完成', LOG_TYPES.SUCCESS);
      } catch (error) {
        log(`流程执行失败`, LOG_TYPES.ERROR);
      }
    }
  };

  // 初始化GUI
  useEffect(() => {
    const initGui = async () => {
      try {
        // 如果已经初始化或正在初始化，直接返回
        if (guiController.isInitialized() || guiController.isInitializing()) {
          return;
        }

        // 确保状态重置
        setIsInitialized(false);
        setNodeList([]);

        // 创建示例节点
        createExampleNode();

        // 添加超时处理
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GUI初始化超时')), 5000);
        });

        await Promise.race([
          guiController.initialize(),
          timeoutPromise
        ]);

        setNodeList(guiController.getNodeList());
        setIsInitialized(true);
      } catch (error) {
        log(`GUI初始化失败: ${error.message}`, LOG_TYPES.ERROR);
        // 如果初始化失败，直接设置状态为已初始化，避免界面卡在加载状态
        setIsInitialized(true);
      }
    };

    initGui();
  }, []);

  /**
   * 处理节点变化（位置、大小等）
   * 使用 useCallback 优化性能
   * 
   * @param {Array} changes - 节点变化数组，包含以下可能的操作：
   *   - select: 选择/取消选择节点
   *   - position: 节点位置变化
   *   - dimensions: 节点尺寸变化
   *   - remove: 删除节点
   */
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  /**
   * 处理边的变化（连接、断开等）
   * 使用 useCallback 优化性能
   */
  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  /**
   * 处理连接验证
   * 确保只能从输出连接到输入
   */
  const onConnect = useCallback((params) => {
    const sourceNode = nodes.find(node => node.id === params.source);
    const targetNode = nodes.find(node => node.id === params.target);

    if (sourceNode && targetNode) {
      const sourceOutput = sourceNode.data.outputs[params.sourceHandle.split('-')[1]];
      const targetInput = targetNode.data.inputs[params.targetHandle.split('-')[1]];

      if (sourceOutput && targetInput && sourceOutput.type === targetInput.type) {
        setEdges((eds) => [...eds, {
          ...params,
          id: `edge-${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}-${Date.now()}`
        }]);
      } else {
        log(`连接失败: 类型不匹配 (${sourceOutput?.type} -> ${targetInput?.type})`, LOG_TYPES.WARNING);
      }
    }
  }, [nodes]);

  const handleAddNode = () => {
    setIsModalOpen(true);
  };

  // 删除节点回调
  const handleDeleteNode = useCallback((id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, []);

  const handleOpenConfig = useCallback((id) => {
    log(`打开配置: ${id}`, LOG_TYPES.INFO);
    const node = nodesRef.current.find(n => n.id === id);
    setConfigNode(node);
    setConfigModalOpen(true);
  }, []);

  const handleColorChange = useCallback((nodeId, color) => {
    setNodes(nds =>
      nds.map(node =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, color } }
          : node
      )
    );
  }, []);

  const nodeTypes = useMemo(
    () => ({
      custom: (props) => <CustomNode {...props} onDelete={handleDeleteNode} onOpenConfig={handleOpenConfig} onColorChange={handleColorChange} />,
    }),
    [handleDeleteNode, handleOpenConfig, handleColorChange]
  );

  // 检查新节点是否与已有节点重叠
  function isOverlapping(x, y, nodes) {
    return nodes.some(n => {
      const nx = n.position.x;
      const ny = n.position.y;
      return (
        Math.abs(nx - x) < NODE_WIDTH &&
        Math.abs(ny - y) < NODE_HEIGHT
      );
    });
  }

  // 修改 handleNodeSelect，自动寻找不重叠位置
  const handleNodeSelect = (node) => {
    const nodeType = node.data.type;
    if (nodeType === '流') {
      let x = 100, y = 100;
      // 尝试找到不重叠的位置
      while (isOverlapping(x, y, nodes)) {
        x += NODE_OFFSET;
        y += NODE_OFFSET;
      }
      const newNode = {
        id: `${node.path}-${Date.now()}`,
        config: node.data,
        type: 'custom',
        position: { x, y },
        path: node.path, // 添加节点路径
        data: {
          type: node.data.type,
          label: node.data.name,
          description: node.data.description,
          inputs: node.data.parameters?.inputs || [],
          outputs: node.data.parameters?.outputs || [],
          config: node.data.config || [], // 添加 config 数据
          color: '#2d2d2d', // 默认色
        },
      };
      setNodes((nds) => {
        const newNodes = [...nds, newNode];
        return newNodes;
      });
      setIsModalOpen(false);
      log(`添加节点: ${node.data.name}`, LOG_TYPES.INFO);
    } else if (nodeType === '任务') {
      let x = 100, y = 100;
      // 尝试找到不重叠的位置
      while (isOverlapping(x, y, nodes)) {
        x += NODE_OFFSET;
        y += NODE_OFFSET;
      }
      const newNode = {
        id: `${node.path}-${Date.now()}`,
        config: node.data,
        type: 'custom',
        position: { x, y },
        path: node.path, // 添加节点路径
        data: {
          type: node.data.type,
          label: node.data.name,
          description: node.data.description,
          inputs: node.data.parameters?.inputs || [],
          outputs: node.data.parameters?.outputs || [],
          config: node.data.config || [], // 添加 config 数据
          color: '#2d2d2d', // 默认色
        },
      };
      setNodes((nds) => {
        const newNodes = [...nds, newNode];
        return newNodes;
      });
      setIsModalOpen(false);
      log(`添加任务节点: ${node.data.name}`, LOG_TYPES.INFO);
    }
  };

  // 添加节点按钮点击事件
  useEffect(() => {
    // 使用 setTimeout 确保 DOM 完全加载
    const timer = setTimeout(() => {
      const addButton = document.querySelector('.node-type');
      if (addButton) {
        // 绑定点击事件：打开节点列表模态框
        addButton.onclick = handleAddNode;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // 处理节点配置更新
  const handleConfigUpdate = useCallback((nodeId, newConfig) => {
    setNodes(nds => nds.map(node => {
      if (node.id === nodeId) {
        // 更新节点的配置数据
        const updatedConfig = node.data.config.map(configItem => {
          const newValue = newConfig[configItem.name];
          if (newValue !== undefined) {
            return {
              ...configItem,
              default_value: newValue
            };
          }
          return configItem;
        });

        // 更新节点数据
        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            config: updatedConfig
          }
        };

        return updatedNode;
      }
      return node;
    }));
  }, []);

  // 处理边的右键点击
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setSelectedEdge(edge);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  // 处理菜单点击
  const onContextMenuClick = useCallback(({ key }) => {
    if (key === 'delete' && selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    } else if (key === 'cancel') {
    }
    setContextMenu(null);
  }, [selectedEdge]);

  // 处理边的选择
  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
  }, []);

  // 处理画布点击，取消边的选择
  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
    setContextMenu(null);
  }, []);

  // 处理导出模板
  const handleExportTemplate = () => {
    if (nodes.length === 0) {
      Modal.warning({
        title: '无法导出模板',
        content: '当前画布中没有节点，请先添加节点后再导出。',
        okText: '确定',
        className: 'dark-modal'
      });
      return;
    }

    Modal.confirm({
      title: '导出模板',
      content: (
        <div>
          <p>请输入模板名称：</p>
          <Input
            placeholder="请输入模板名称"
            onChange={(e) => {
              Modal.confirm.data = e.target.value;
            }}
            style={{ marginTop: '8px' }}
          />
        </div>
      ),
      okText: '确定',
      cancelText: '取消',
      className: 'dark-modal',
      onOk: async () => {
        try {
          const templateName = Modal.confirm.data || '未命名模板';
          const templateDir = templateManager.getTemplateDir();
          const templatePath = path.join(templateDir, `${templateName}.json`);

          // 准备模板数据
          const templateData = {
            name: templateName,
            description: '自定义导出模板',
            version: '1.0.0',
            created: new Date().toISOString(),
            nodes: nodes.map(node => {
              const nodePath = node.path || '';
              const nodeFolder = path.dirname(nodePath);
              const nodeName = path.basename(nodePath);

              return {
                id: node.id,
                type: node.type,
                position: node.position,
                path: nodePath,
                folder: nodeFolder,
                name: nodeName,
                data: {
                  label: node.data.label,
                  description: node.data.description,
                  inputs: node.data.inputs,
                  outputs: node.data.outputs,
                  config: node.data.config,
                  type: node.data.type
                }
              };
            }),
            edges: edges.map(edge => ({
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle
            }))
          };

          // 检查文件是否存在
          const exists = FileController.fileExists(templatePath);
          if (exists) {
            // 如果文件存在，显示覆盖确认对话框
            return new Promise((resolve) => {
              Modal.confirm({
                title: '文件已存在',
                content: `模板 "${templateName}" 已存在，是否覆盖？`,
                okText: '覆盖',
                cancelText: '取消',
                className: 'dark-modal',
                onOk: async () => {
                  try {
                    await templateManager.saveTemplate(templateName, templateData);
                    Modal.success({
                      title: '导出成功',
                      content: '模板已成功导出。',
                      okText: '确定',
                      className: 'dark-modal'
                    });
                    onTreeDataChange();
                    resolve();
                  } catch (error) {
                    Modal.error({
                      title: '导出失败',
                      content: `导出模板时发生错误：${error.message}`,
                      okText: '确定',
                      className: 'dark-modal'
                    });
                    resolve();
                  }
                },
                onCancel: () => {
                  resolve();
                }
              });
            });
          } else {
            // 如果文件不存在，直接保存
            await templateManager.saveTemplate(templateName, templateData);
            Modal.success({
              title: '导出成功',
              content: '模板已成功导出。',
              okText: '确定',
              className: 'dark-modal'
            });
            onTreeDataChange();
          }
        } catch (error) {
          Modal.error({
            title: '导出失败',
            content: `导出模板时发生错误：${error.message}`,
            okText: '确定',
            className: 'dark-modal'
          });
        }
      }
    });
  };

  // 处理应用模板
  const handleApplyTemplate = useCallback((templateData) => {
    // 清空当前画布
    setNodes([]);
    setEdges([]);

    // 添加模板中的节点
    const newNodes = templateData.nodes.map(node => ({
      ...node,
      type: 'custom',
      data: {
        ...node.data,
        onDelete: () => handleDeleteNode(node.id)
      }
    }));
    setNodes(newNodes);

    // 添加模板中的边，确保每条边都有唯一的 id
    const newEdges = templateData.edges.map(edge => ({
      ...edge,
      id: `edge-${edge.source}-${edge.sourceHandle}-${edge.target}-${edge.targetHandle}-${Date.now()}`,
      style: {
        stroke: '#555',
        strokeWidth: 2,
      }
    }));
    setEdges(newEdges);

    // 刷新项目树
    if (onTreeDataChange) {
      onTreeDataChange();
    }
  }, [handleDeleteNode, onTreeDataChange]);

  // 自动排版函数
  const handleAutoLayout = () => {
    Modal.confirm({
      title: '自动排版',
      content: '确定要对当前画布进行自动排版吗？',
      okText: '确定',
      cancelText: '取消',
      className: 'dark-modal',
      onOk: () => {
        // 布局参数
        const LAYOUT_CONFIG = {
          baseWidth: 220,    // 节点基础宽度
          baseHeight: 120,   // 节点基础高度
          portHeight: 50,    // 端口高度
          portWidth: 20,     // 端口宽度
          charWidth: 8,      // 字符宽度
          hSpacing: 300,     // 水平间距
          vSpacing: 50,     // 垂直间距（从200改为100）
          leftMargin: 100,   // 左边距
          topMargin: 100,    // 上边距
          safetyMargin: 50,  // 安全边距
          padding: 40        // 内边距
        };

        // 计算节点尺寸
        const calculateNodeSize = (node) => {
          const { inputs = [], outputs = [] } = node.data;
          const portCount = Math.max(inputs.length, outputs.length);
          const height = LAYOUT_CONFIG.baseHeight + (portCount * LAYOUT_CONFIG.portHeight);

          let width = LAYOUT_CONFIG.baseWidth;
          const labelWidth = (node.data.label?.length || 0) * LAYOUT_CONFIG.charWidth;
          const portsWidth = (inputs.length + outputs.length) * LAYOUT_CONFIG.portWidth;

          width = Math.max(width, labelWidth + LAYOUT_CONFIG.padding, portsWidth + LAYOUT_CONFIG.padding);
          return { width, height };
        };

        // 构建节点关系图
        const buildNodeGraph = () => {
          const nodeMap = new Map();
          const rootNodes = new Set();

          // 初始化节点
          nodes.forEach(node => {
            const size = calculateNodeSize(node);
            nodeMap.set(node.id, {
              node,
              size,
              children: new Set(),
              parents: new Set(),
              level: 0,
              position: { x: 0, y: 0 }
            });
            rootNodes.add(node.id);
          });

          // 建立节点关系
          edges.forEach(edge => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (source && target) {
              source.children.add(edge.target);
              target.parents.add(edge.source);
              rootNodes.delete(edge.target);
            }
          });

          return { nodeMap, rootNodes };
        };

        // 检查位置是否可用
        const isPositionAvailable = (x, y, width, height, nodeMap, excludeId = null) => {
          for (const [nodeId, nodeInfo] of nodeMap) {
            if (nodeId === excludeId) continue;
            
            const { x: nodeX, y: nodeY } = nodeInfo.position;
            const { width: nodeWidth, height: nodeHeight } = nodeInfo.size;
            
            const hOverlap = (x < nodeX + nodeWidth + LAYOUT_CONFIG.safetyMargin) && 
                           (x + width + LAYOUT_CONFIG.safetyMargin > nodeX);
            const vOverlap = (y < nodeY + nodeHeight + LAYOUT_CONFIG.safetyMargin) && 
                           (y + height + LAYOUT_CONFIG.safetyMargin > nodeY);
            
            if (hOverlap && vOverlap) return false;
          }
          return true;
        };

        // 寻找可用位置
        const findAvailablePosition = (startX, startY, width, height, nodeMap, excludeId = null) => {
          let x = startX;
          let y = startY;
          let attempts = 0;
          const maxAttempts = 100;

          while (!isPositionAvailable(x, y, width, height, nodeMap, excludeId) && attempts < maxAttempts) {
            y += LAYOUT_CONFIG.vSpacing;
            if (attempts % 5 === 0) {
              x += LAYOUT_CONFIG.hSpacing;
              y = startY;
            }
            attempts++;
          }

          return { x, y };
        };

        // 布局节点
        const layoutNodes = (nodeMap, rootNodes) => {
          // 先处理根节点（没有输入的节点）
          let currentY = LAYOUT_CONFIG.topMargin;
          const rootNodeArray = Array.from(rootNodes);
          const rootX = LAYOUT_CONFIG.leftMargin; // 所有根节点使用相同的X坐标

          // 第一遍：垂直排列根节点
          rootNodeArray.forEach(rootId => {
            const nodeInfo = nodeMap.get(rootId);
            // 只检查Y方向的重叠，因为X是固定的
            const position = findAvailablePosition(
              rootX,
              currentY,
              nodeInfo.size.width,
              nodeInfo.size.height,
              nodeMap,
              rootId
            );
            // 保持X坐标不变，只更新Y坐标
            nodeInfo.position = { x: rootX, y: position.y };
            currentY = position.y + nodeInfo.size.height + LAYOUT_CONFIG.vSpacing;
          });

          // 第二遍：处理每个根节点的子节点
          rootNodeArray.forEach(rootId => {
            const processChildren = (parentId, level) => {
              const parent = nodeMap.get(parentId);
              const children = Array.from(parent.children);
              
              children.forEach((childId, index) => {
                const child = nodeMap.get(childId);
                const startX = parent.position.x + parent.size.width + LAYOUT_CONFIG.hSpacing;
                const startY = parent.position.y + (index * LAYOUT_CONFIG.vSpacing);
                
                const position = findAvailablePosition(
                  startX,
                  startY,
                  child.size.width,
                  child.size.height,
                  nodeMap,
                  childId
                );
                
                child.position = position;
                child.level = level;
                
                // 递归处理子节点的子节点
                processChildren(childId, level + 1);
              });
            };
            
            processChildren(rootId, 1);
          });
        };

        // 执行布局
        const { nodeMap, rootNodes } = buildNodeGraph();
        layoutNodes(nodeMap, rootNodes);

        // 更新节点位置
        const newNodes = nodes.map(node => ({
          ...node,
          position: nodeMap.get(node.id).position
        }));

        setNodes(newNodes);
      }
    });
  };

  // 清空画布函数
  const handleClearCanvas = () => {
    Modal.confirm({
      title: '清空画布',
      content: '确定要清空当前画布吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      className: 'dark-modal',
      onOk: () => {
        setNodes([]);
        setEdges([]);
      }
    });
  };

  return (
    <div className="main-content">
      {!isInitialized ? (
        <div className="loading">正在初始化...</div>
      ) : (
        <>
          <div className={`top-toolbar${isToolbarCollapsed ? ' collapsed' : ''}`} onClick={isToolbarCollapsed ? () => setIsToolbarCollapsed(false) : undefined}>
            <button
              className="toolbar-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsToolbarCollapsed(!isToolbarCollapsed);
              }}
              title={isToolbarCollapsed ? "展开工具栏" : "收起工具栏"}
            >
              {isToolbarCollapsed ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L8 10L12 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 10L8 6L4 10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            {!isToolbarCollapsed && (
              <div className="toolbar-buttons">
                <button
                  className={`toolbar-button ${isRunning ? 'danger' : 'primary'}`}
                  onClick={handleRunStop}
                  title={isRunning ? "停止运行" : "运行流程"}
                >
                  {isRunning ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                      <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <button
                  className="toolbar-button"
                  onClick={() => setIsTemplateManagerVisible(true)}
                  title="模板管理"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                    <path fillRule="evenodd" d="M1.5 6.375c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v3.026a.75.75 0 0 1-.375.65 2.249 2.249 0 0 0 0 3.898.75.75 0 0 1 .375.65v3.026c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 17.625v-3.026a.75.75 0 0 1 .374-.65 2.249 2.249 0 0 0 0-3.898.75.75 0 0 1-.374-.65V6.375Zm15-1.125a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm.75 4.5a.75.75 0 0 0-1.5 0v.75a.75.75 0 0 0 1.5 0v-.75Zm-.75 3a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-1.5 0v-.75a.75.75 0 0 1 .75-.75Zm.75 4.5a.75.75 0 0 0-1.5 0V18a.75.75 0 0 0 1.5 0v-.75ZM6 12a.75.75 0 0 1 .75-.75H12a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 12Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
                  </svg>
                </button>

                <button
                  className="toolbar-button"
                  onClick={handleExportTemplate}
                  title="导出模板"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                    <path d="M9.97.97a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06l-1.72-1.72v3.44h-1.5V3.31L8.03 5.03a.75.75 0 0 1-1.06-1.06l3-3ZM9.75 6.75v6a.75.75 0 0 0 1.5 0v-6h3a3 3 0 0 1 3 3v7.5a3 3 0 0 1-3 3h-7.5a3 3 0 0 1-3-3v-7.5a3 3 0 0 1 3-3h3Z" />
                    <path d="M7.151 21.75a2.999 2.999 0 0 0 2.599 1.5h7.5a3 3 0 0 0 3-3v-7.5c0-1.11-.603-2.08-1.5-2.599v7.099a4.5 4.5 0 0 1-4.5 4.5H7.151Z" />
                  </svg>
                </button>

                <button
                  className="toolbar-button"
                  onClick={handleAutoLayout}
                  title="自动排版"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                    <path fillRule="evenodd" d="M11.622 1.602a.75.75 0 0 1 .756 0l2.25 1.313a.75.75 0 0 1-.756 1.295L12 3.118 10.128 4.21a.75.75 0 1 1-.756-1.295l2.25-1.313ZM5.898 5.81a.75.75 0 0 1-.27 1.025l-1.14.665 1.14.665a.75.75 0 1 1-.756 1.295L3.75 8.806v.944a.75.75 0 0 1-1.5 0V7.5a.75.75 0 0 1 .372-.648l2.25-1.312a.75.75 0 0 1 1.026.27Zm12.204 0a.75.75 0 0 1 1.026-.27l2.25 1.312a.75.75 0 0 1 .372.648v2.25a.75.75 0 0 1-1.5 0v-.944l-1.122.654a.75.75 0 1 1-.756-1.295l1.14-.665-1.14-.665a.75.75 0 0 1-.27-1.025Zm-9 5.25a.75.75 0 0 1 1.026-.27L12 11.882l1.872-1.092a.75.75 0 1 1 .756 1.295l-1.878 1.096V15a.75.75 0 0 1-1.5 0v-1.82l-1.878-1.095a.75.75 0 0 1-.27-1.025ZM3 13.5a.75.75 0 0 1 .75.75v1.82l1.878 1.095a.75.75 0 1 1-.756 1.295l-2.25-1.312a.75.75 0 0 1-.372-.648v-2.25A.75.75 0 0 1 3 13.5Zm18 0a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.372.648l-2.25 1.312a.75.75 0 1 1-.756-1.295l1.878-1.096V14.25a.75.75 0 0 1 .75-.75Zm-9 5.25a.75.75 0 0 1 .75.75v.944l1.122-.654a.75.75 0 1 1 .756 1.295l-2.25 1.313a.75.75 0 0 1-.756 0l-2.25-1.313a.75.75 0 1 1 .756-1.295l1.122.654V19.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                  </svg>
                </button>

                <button
                  className="toolbar-button"
                  onClick={handleClearCanvas}
                  title="清空画布"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                  </svg>
                </button>

                <button
                  className="toolbar-button"
                  onClick={handleAddNode}
                  title="添加节点"
                >
                  <svg width="25" height="25" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3V13M3 8H13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges.map(edge => ({
              ...edge,
              style: {
                stroke: edge.id === selectedEdge?.id ? '#00ff00' : edge.style?.stroke || '#555',
                strokeWidth: edge.id === selectedEdge?.id ? 2.5 : edge.style?.strokeWidth || 2,
                transition: 'stroke 0.3s, stroke-width 0.3s',
              }
            }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onEdgeClick={onEdgeClick}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ minZoom: 0.01, maxZoom: 50, padding: 0.05 }}
          >
            <Background />
            <NodeButton onNodeSelect={handleNodeSelect} />
            <MiniMap
              nodeColor={(node) => {
                // 根据节点类型设置小地图中的节点颜色
                switch (node.type) {
                  case 'input':
                    return '#2d2d2d';  // 输入节点颜色
                  default:
                    return '#2d2d2d';  // 默认节点颜色
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              pannable={true}
              zoomable={true}
              style={{
                backgroundColor: '#2d2d2d',
                borderRadius: '4px',
                border: '1px solid #444'
              }}
            />
          </ReactFlow>
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
                  key: 'delete',
                  label: '断开',
                  style: { color: '#fff' },
                },
                {
                  key: 'cancel',
                  label: '取消',
                  style: { color: '#fff' },
                },
              ]}
              onClick={onContextMenuClick}
            />
          )}
          <TemplateManager
            visible={isTemplateManagerVisible}
            onClose={() => setIsTemplateManagerVisible(false)}
            onApplyTemplate={handleApplyTemplate}
          />
        </>
      )}
      <NodeListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        nodes={nodeList}
        onNodeSelect={handleNodeSelect}
      />
      <NodeConfigModal
        open={configModalOpen}
        node={configNode}
        onClose={() => setConfigModalOpen(false)}
        onSave={(newConfig) => {
          if (configNode) {
            handleConfigUpdate(configNode.id, newConfig);
          }
        }}
      />
    </div>
  );
};

export default MainContent; 