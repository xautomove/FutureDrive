import React, { useState, useEffect, useRef } from 'react';
import { Button, Tooltip, Input, Form, Select, Switch, message } from 'antd';
import { Resizable } from 're-resizable';
import { 
  LineOutlined, 
  AppstoreOutlined, 
  PushpinOutlined, 
  DeleteOutlined, 
  UndoOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  MenuOutlined,
  CloseOutlined,
  ImportOutlined
} from '@ant-design/icons';
import FileController from '../../controller/gui/FileController';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader';
import './MapEditor.css';

const fs = window.require('fs');
const path = window.require('path');

const { Option } = Select;

const pencilCursor =
  'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"currentColor\\" class=\\"size-6\\"><path d=\\"M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z\\"/></svg>") 0 32, auto'

const MapEditor = () => {
  const [selectedTool, setSelectedTool] = useState(null);
  const [layers, setLayers] = useState([
    { id: 100, name: '道路线', visible: true, type: 'line', isLane: true },
    { id: 1, name: '车道线', visible: true, type: 'line' },
    { id: 2, name: '停车区', visible: true, type: 'polygon' },
    { id: 3, name: '路口', visible: true, type: 'point' }
  ]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [rightWidth, setRightWidth] = useState(300);
  const [showLayers, setShowLayers] = useState(false);
  const [drawingLine, setDrawingLine] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState([]); // 临时未闭合点
  const [polygons, setPolygons] = useState([]); // 已闭合区域
  const [mousePos, setMousePos] = useState(null); // 记录鼠标在世界坐标下的位置
  const [firstPoint, setFirstPoint] = useState(null); // 记录第一个点
  
  // 使用 ref 保存状态
  const currentPolygonRef = useRef([]);
  const mousePosRef = useRef(null);
  const polygonsRef = useRef([]);
  const lineObjectsRef = useRef([]); // 存储临时线对象
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const canvasRef = useRef(null);
  const [form] = Form.useForm();
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const drawCanvasRef = useRef(null);

  // 同步更新 ref
  useEffect(() => {
    currentPolygonRef.current = currentPolygon;
  }, [currentPolygon]);

  useEffect(() => {
    mousePosRef.current = mousePos;
  }, [mousePos]);

  useEffect(() => {
    polygonsRef.current = polygons;
  }, [polygons]);

  // 初始化Three.js场景
  useEffect(() => {
    if (!canvasRef.current) return;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 20); // Z轴正上方
    camera.up.set(0, 1, 0);        // Y轴为上
    camera.lookAt(0, 0, 0);        // 朝向原点
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    rendererRef.current = renderer;

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    // 禁用旋转，允许缩放和平移
    controls.enableRotate = false;
    controls.enableZoom = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    // 添加相机移动事件监听（带防抖）
    let lastFrame = null;
    controls.addEventListener('change', () => {
      if (lastFrame) cancelAnimationFrame(lastFrame);
      lastFrame = requestAnimationFrame(() => {
        console.log('相机移动，触发重绘');
        redrawCanvas();
      });
    });

    // 添加网格（XY平面，Z轴朝用户）
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.rotation.x = Math.PI / 2; // 让网格平铺在XY平面
    scene.add(gridHelper);

    // 添加坐标轴辅助器
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 处理窗口大小变化
    const handleResize = () => {
      if (!canvasRef.current) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', () => {});
      renderer.dispose();
    };
  }, []);

  // 工具按钮配置
  const tools = [
    { key: 'import', icon: <ImportOutlined />, tooltip: '导入PCD文件' },
    { key: 'line', icon: <LineOutlined />, tooltip: '画线工具' },
    { key: 'polygon', icon: <AppstoreOutlined />, tooltip: '画多边形工具' },
    { key: 'point', icon: <PushpinOutlined />, tooltip: '添加点工具' },
    { key: 'delete', icon: <DeleteOutlined />, tooltip: '删除工具' },
    { key: 'undo', icon: <UndoOutlined />, tooltip: '撤销工具' }
  ];

  // 处理工具选择
  const handleToolSelect = (tool) => {
    if (tool === 'import') {
      handleImportPCD();
    } else if (tool === 'line') {
      if (drawingLine) {
        setCurrentPolygon([]);
        setIsDrawingPolygon(false);
        setDrawingLine(false);
        setSelectedTool(null);
        setFirstPoint(null);
        setMousePos(null);
      } else {
        setSelectedTool(tool);
      }
    } else {
      setSelectedTool(tool);
    }
  };

  // 处理PCD文件导入
  const handleImportPCD = async () => {
    try {
      const result = await FileController.selectFile({
        title: '选择PCD文件',
        filters: [
          { name: 'PCD文件', extensions: ['pcd'] }
        ]
      });
      
      if (result.success) {
        console.log(result.filePath);
        loadPCDFile(result.filePath);
      }
    } catch (error) {
      message.error('文件导入失败');
      console.error('导入PCD文件失败:', error);
    }
  };

  // 加载PCD文件
  const loadPCDFile = (filePath) => {
    try {
      // 读取PCD文件
      const buffer = fs.readFileSync(filePath);
      
      // 创建PCDLoader
      const loader = new PCDLoader();
      
      // 解析PCD数据
      const points = loader.parse(buffer, filePath);
      
      // 检查点云数据
      if (!points || !points.geometry || !points.geometry.attributes || !points.geometry.attributes.position) {
        throw new Error('点云数据格式不正确');
      }

      console.log('点云数据:', points);
      console.log('点云属性:', points.geometry.attributes);

      // 移除之前的点云
      if (sceneRef.current) {
        const oldPoints = sceneRef.current.getObjectByName('pointCloud');
        if (oldPoints) {
          sceneRef.current.remove(oldPoints);
        }
      }

      // 获取点云数据
      const positions = points.geometry.attributes.position.array;
      const colors = points.geometry.attributes.color ? points.geometry.attributes.color.array : null;

      // 直接使用原始XYZ坐标
      const filteredPositions = [];
      const filteredColors = [];
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (z >= 0 && z <= 5.0) {
          filteredPositions.push(x, y, z);
          if (colors) {
            filteredColors.push(colors[i], colors[i + 1], colors[i + 2]);
          }
        }
      }

      console.log('过滤后的点云数据:', {
        originalPoints: positions.length / 3,
        filteredPoints: filteredPositions.length / 3
      });

      // 过滤后无点处理
      if (filteredPositions.length === 0) {
        message.error('过滤后没有可用的点云数据');
        return;
      }

      // 计算点云Y轴最大值
      let maxY = -Infinity;
      for (let i = 1; i < filteredPositions.length; i += 3) {
        if (filteredPositions[i] > maxY) maxY = filteredPositions[i];
      }

      // 创建新的几何体
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(filteredPositions, 3));
      if (filteredColors.length > 0) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(filteredColors, 3));
      }

      // 创建点云材质
      const material = new THREE.PointsMaterial({
        size: 0.1,
        color: 0xffffff,  // 使用白色
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
      });

      // 创建点云对象
      const pointCloud = new THREE.Points(geometry, material);
      pointCloud.name = 'pointCloud';
      // 平移点云，使其顶部与网格平面对齐（Y=0）
      pointCloud.position.y = -maxY;
      sceneRef.current.add(pointCloud);

      // 计算点云包围盒和中心
      const box = new THREE.Box3().setFromObject(pointCloud);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      message.success('点云文件加载成功');
    } catch (error) {
      message.error('点云文件加载失败');
      console.error('加载PCD文件失败:', error);
      console.error('错误堆栈:', error.stack);
      message.error('点云文件加载失败');
    }
  };
  
  // 处理图层可见性切换
  const handleLayerVisibility = (layerId) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  };
  
  // 处理元素选择
  const handleElementSelect = (element) => {
    setSelectedElement(element);
    form.setFieldsValue(element.properties);
  };

  // 处理属性更新
  const handlePropertiesUpdate = (values) => {
    if (selectedElement) {
      // 更新选中元素的属性
      const updatedElement = {
        ...selectedElement,
        properties: values
      };
      // TODO: 实现属性更新逻辑
    }
  };

  // 确保 2D canvas 尺寸与 Three.js canvas 一致
  useEffect(() => {
    if (!canvasRef.current || !drawCanvasRef.current) return;
    
    const updateCanvasSize = () => {
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      // 设置 2D canvas 尺寸
      drawCanvasRef.current.width = width;
      drawCanvasRef.current.height = height;
      
      // 设置 2D canvas 样式
      const ctx = drawCanvasRef.current.getContext('2d', { alpha: true });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      
      // 清除画布
      ctx.clearRect(0, 0, width, height);
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // 统一的绘制函数
  const redrawCanvas = () => {
    if (!drawCanvasRef.current || !cameraRef.current) {
      console.log('绘制失败：canvas 或 camera 不存在');
      return;
    }
    
    console.log('开始重绘');
    console.log('当前多边形点数:', currentPolygonRef.current.length);
    console.log('已完成的区域数:', polygonsRef.current.length);
    console.log('polygons 数据:', JSON.stringify(polygonsRef.current));
    
    const ctx = drawCanvasRef.current.getContext('2d', { alpha: true });
    const width = drawCanvasRef.current.width;
    const height = drawCanvasRef.current.height;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置全局绘制样式
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    
    // 绘制当前正在绘制的线
    if (currentPolygonRef.current.length > 0) {
      console.log('绘制当前线');
      ctx.beginPath();
      const start = worldToScreen(new THREE.Vector3(...currentPolygonRef.current[0]), cameraRef.current, width, height);
      console.log('起点坐标:', start);
      ctx.moveTo(start.x, start.y);
      
      currentPolygonRef.current.slice(1).forEach((point, index) => {
        const p = worldToScreen(new THREE.Vector3(...point), cameraRef.current, width, height);
        console.log(`第${index + 1}个点坐标:`, p);
        ctx.lineTo(p.x, p.y);
      });
      
      // 绘制预览线
      if (mousePosRef.current) {
        const p = worldToScreen(new THREE.Vector3(...mousePosRef.current), cameraRef.current, width, height);
        console.log('预览点坐标:', p);
        ctx.lineTo(p.x, p.y);
      }
      
      ctx.stroke();
    }
    
    // 绘制已完成的区域
    if (polygonsRef.current && polygonsRef.current.length > 0) {
      console.log('开始绘制已完成的区域');
      polygonsRef.current.forEach((polygon, idx) => {
        if (polygon && polygon.length > 2) {
          console.log(`绘制第${idx + 1}个区域`);
          // 绘制面
          ctx.beginPath();
          const start = worldToScreen(new THREE.Vector3(...polygon[0]), cameraRef.current, width, height);
          console.log('区域起点坐标:', start);
          ctx.moveTo(start.x, start.y);
          
          polygon.slice(1).forEach((point, index) => {
            const p = worldToScreen(new THREE.Vector3(...point), cameraRef.current, width, height);
            console.log(`区域第${index + 1}个点坐标:`, p);
            ctx.lineTo(p.x, p.y);
          });
          
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 191, 174, 0.3)';
          ctx.fill();
          
          // 绘制边线
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          polygon.slice(1).forEach(point => {
            const p = worldToScreen(new THREE.Vector3(...point), cameraRef.current, width, height);
            ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
        }
      });
    }
    
    console.log('重绘完成');
  };

  // 渲染所有已闭合区域和当前临时线
  useEffect(() => {
    console.log('状态变化，触发重绘');
    redrawCanvas();
  }, [polygons, currentPolygon, mousePos]);

  // 画线工具激活时，canvas监听点击、mousemove和ESC
  useEffect(() => {
    if (selectedTool !== 'line' || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    
    // 点击事件
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const vector = new THREE.Vector3(x, y, 0.5);
      vector.unproject(cameraRef.current);
      
      // 记录第一个点
      if (currentPolygon.length === 0) {
        setFirstPoint([vector.x, vector.y, vector.z]);
        setCurrentPolygon([[vector.x, vector.y, vector.z]]);
        return;
      }
      
      // 判断是否闭合
      if (firstPoint) {
        const [fx, fy, fz] = firstPoint;
        const dist = Math.sqrt(
          Math.pow(vector.x - fx, 2) + Math.pow(vector.y - fy, 2) + Math.pow(vector.z - fz, 2)
        );
        console.log('dist', dist);
        if (dist < 0.01) {
          console.log('闭合');
          setPolygons(prev => [...prev, [...currentPolygon, firstPoint]]);
          setCurrentPolygon([]);
          setIsDrawingPolygon(false);
          setFirstPoint(null);
          setMousePos(null);
          return;
        }
      }
      
      setCurrentPolygon(prev => [...prev, [vector.x, vector.y, vector.z]]);
    };
    
    // 鼠标移动事件
    const handleMouseMove = (e) => {
      if (currentPolygon.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const vector = new THREE.Vector3(x, y, 0.5);
      vector.unproject(cameraRef.current);
      
      setMousePos([vector.x, vector.y, vector.z]);
    };
    
    // ESC取消
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCurrentPolygon([]);
        setIsDrawingPolygon(false);
        setDrawingLine(false);
        setFirstPoint(null);
        setMousePos(null);
      }
    };
    
    // 右键撤销
    const handleRightClick = (e) => {
      e.preventDefault();
      setCurrentPolygon(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
    };
    
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('contextmenu', handleRightClick);
    setDrawingLine(true);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('contextmenu', handleRightClick);
      setDrawingLine(false);
    };
  }, [selectedTool, currentPolygon, firstPoint]);

  // 禁用/恢复OrbitControls交互
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = selectedTool !== 'line';
  }, [selectedTool]);

  // worldToScreen 投影函数
  function worldToScreen(worldPos, camera, canvasWidth, canvasHeight) {
    const vector = worldPos instanceof THREE.Vector3 ? worldPos : new THREE.Vector3(...worldPos);
    const projected = vector.clone().project(camera);
    return {
      x: (projected.x + 1) / 2 * canvasWidth,
      y: (-projected.y + 1) / 2 * canvasHeight
    };
  }

  return (
    <div className="map-editor">
      {/* 左侧工具栏 */}
      <div className="map-editor-toolbar-wrapper">
        <div className="map-editor-toolbar">
          {tools.map(tool => (
            <Tooltip key={tool.key} title={tool.tooltip}>
              <Button
                type={selectedTool === tool.key ? 'primary' : 'default'}
                icon={tool.icon}
                onClick={() => handleToolSelect(tool.key)}
              />
            </Tooltip>
          ))}
        </div>
      </div>

      {/* 中间画布区域 */}
      <div className="map-editor-canvas" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          style={{ 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            zIndex: 1,
            width: '100%',
            height: '100%'
          }}
        />
        <canvas
          ref={drawCanvasRef}
          style={{ 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            zIndex: 10,
            width: '100%',
            height: '100%',
            pointerEvents: selectedTool === 'line' ? 'auto' : 'none',
            touchAction: 'none',  // 防止触摸事件干扰
            backgroundColor: 'rgba(255, 0, 0, 0.1)'  // 添加半透明红色背景
          }}
        />
        {/* 图层控制按钮 */}
        <Button
          className="map-editor-layers-toggle"
          type="primary"
          icon={<MenuOutlined />}
          onClick={() => setShowLayers(!showLayers)}
        />
      </div>

      {/* 右侧面板 */}
      <Resizable
        size={{ width: rightWidth, height: '100%' }}
        onResizeStop={(e, direction, ref, d) => {
          setRightWidth(rightWidth - d.width);
        }}
        minWidth={200}
        maxWidth={500}
        enable={{ left: true }}
        className="map-editor-properties-wrapper"
      >
        <div className="map-editor-properties">
          {showLayers ? (
            <>
              <div className="map-editor-layers-header">
                <h3>图层列表</h3>
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => setShowLayers(false)}
                />
              </div>
              <div className="map-editor-layers-content">
                {layers.map(layer => (
                  <div key={layer.id} className="layer-item">
                    <Switch
                      checked={layer.visible}
                      onChange={() => handleLayerVisibility(layer.id)}
                      checkedChildren={<EyeOutlined />}
                      unCheckedChildren={<EyeInvisibleOutlined />}
                    />
                    <span>{layer.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3>属性面板</h3>
              {selectedElement && (
                <Form
                  form={form}
                  layout="vertical"
                  onValuesChange={handlePropertiesUpdate}
                >
                  <Form.Item label="ID" name="id">
                    <Input disabled />
                  </Form.Item>
                  <Form.Item label="类型" name="type">
                    <Select>
                      <Option value="line">车道线</Option>
                      <Option value="polygon">停车区</Option>
                      <Option value="point">路口</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="限速" name="speedLimit">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item label="方向" name="direction">
                    <Select>
                      <Option value="forward">正向</Option>
                      <Option value="backward">反向</Option>
                      <Option value="both">双向</Option>
                    </Select>
                  </Form.Item>
                </Form>
              )}
            </>
          )}
        </div>
      </Resizable>
    </div>
  );
};

export default MapEditor; 