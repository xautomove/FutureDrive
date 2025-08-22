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
import { useI18n } from '../../context/I18nContext';
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
  const { t } = useI18n();
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
  const [currentPolygon, setCurrentPolygon] = useState([]); 
  const [polygons, setPolygons] = useState([]); 
  const [mousePos, setMousePos] = useState(null); 
  const [firstPoint, setFirstPoint] = useState(null); 
  
  const currentPolygonRef = useRef([]);
  const mousePosRef = useRef(null);
  const polygonsRef = useRef([]);
  const lineObjectsRef = useRef([]); 
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const canvasRef = useRef(null);
  const [form] = Form.useForm();
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const drawCanvasRef = useRef(null);

  useEffect(() => {
    currentPolygonRef.current = currentPolygon;
  }, [currentPolygon]);

  useEffect(() => {
    mousePosRef.current = mousePos;
  }, [mousePos]);

  useEffect(() => {
    polygonsRef.current = polygons;
  }, [polygons]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

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

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enableRotate = false;
    controls.enableZoom = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    let lastFrame = null;
    controls.addEventListener('change', () => {
      if (lastFrame) cancelAnimationFrame(lastFrame);
      lastFrame = requestAnimationFrame(() => {
        redrawCanvas();
      });
    });

    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

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

  const tools = [
    { key: 'import', icon: <ImportOutlined />, tooltip: t('mapEditor.importPCD') },
    { key: 'line', icon: <LineOutlined />, tooltip: t('mapEditor.drawLine') },
    { key: 'polygon', icon: <AppstoreOutlined />, tooltip: t('mapEditor.drawPolygon') },
    { key: 'point', icon: <PushpinOutlined />, tooltip: t('mapEditor.addPoint') },
    { key: 'delete', icon: <DeleteOutlined />, tooltip: t('mapEditor.deleteTool') },
    { key: 'undo', icon: <UndoOutlined />, tooltip: t('mapEditor.undoTool') }
  ];

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

  const handleImportPCD = async () => {
    try {
      const result = await FileController.selectFile({
        title: t('mapEditor.choosePCDTitle'),
        filters: [
          { name: t('mapEditor.pcdFilterName'), extensions: ['pcd'] }
        ]
      });
      
      if (result.success) {
        loadPCDFile(result.filePath);
      }
    } catch (error) {
      message.error(t('mapEditor.fileImportFailed'));
      console.error('导入PCD文件失败:', error);
    }
  };

  // 加载PCD文件
  const loadPCDFile = (filePath) => {
    try {
      const buffer = fs.readFileSync(filePath);
      
      const loader = new PCDLoader();
      
      const points = loader.parse(buffer, filePath);
      
      if (!points || !points.geometry || !points.geometry.attributes || !points.geometry.attributes.position) {
        throw new Error(t('mapEditor.invalidPointCloud'));
      }

      if (sceneRef.current) {
        const oldPoints = sceneRef.current.getObjectByName('pointCloud');
        if (oldPoints) {
          sceneRef.current.remove(oldPoints);
        }
      }

      const positions = points.geometry.attributes.position.array;
      const colors = points.geometry.attributes.color ? points.geometry.attributes.color.array : null;

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

      if (filteredPositions.length === 0) {
        message.error(t('mapEditor.noPointsAfterFilter'));
        return;
      }

      let maxY = -Infinity;
      for (let i = 1; i < filteredPositions.length; i += 3) {
        if (filteredPositions[i] > maxY) maxY = filteredPositions[i];
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(filteredPositions, 3));
      if (filteredColors.length > 0) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(filteredColors, 3));
      }

      const material = new THREE.PointsMaterial({
        size: 0.1,
        color: 0xffffff,  // 使用白色
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
      });

      const pointCloud = new THREE.Points(geometry, material);
      pointCloud.name = 'pointCloud';
      pointCloud.position.y = -maxY;
      sceneRef.current.add(pointCloud);

      const box = new THREE.Box3().setFromObject(pointCloud);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      message.success(t('mapEditor.loadSuccess'));
    } catch (error) {
      message.error(t('mapEditor.loadFailed'));
      console.error('加载PCD文件失败:', error);
      console.error('错误堆栈:', error.stack);
      message.error(t('mapEditor.loadFailed'));
    }
  };
  
  const handleLayerVisibility = (layerId) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  };
  
  const handleElementSelect = (element) => {
    setSelectedElement(element);
    form.setFieldsValue(element.properties);
  };

  const handlePropertiesUpdate = (values) => {
    if (selectedElement) {
      const updatedElement = {
        ...selectedElement,
        properties: values
      };
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !drawCanvasRef.current) return;
    
    const updateCanvasSize = () => {
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      drawCanvasRef.current.width = width;
      drawCanvasRef.current.height = height;
      
      const ctx = drawCanvasRef.current.getContext('2d', { alpha: true });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      
      ctx.clearRect(0, 0, width, height);
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  const redrawCanvas = () => {
    if (!drawCanvasRef.current || !cameraRef.current) {
      console.log(t('mapEditor.drawFailed'));
      return;
    }
    
    const ctx = drawCanvasRef.current.getContext('2d', { alpha: true });
    const width = drawCanvasRef.current.width;
    const height = drawCanvasRef.current.height;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    
    if (currentPolygonRef.current.length > 0) {
      ctx.beginPath();
      const start = worldToScreen(new THREE.Vector3(...currentPolygonRef.current[0]), cameraRef.current, width, height);
      ctx.moveTo(start.x, start.y);
      
      currentPolygonRef.current.slice(1).forEach((point, index) => {
        const p = worldToScreen(new THREE.Vector3(...point), cameraRef.current, width, height);
        ctx.lineTo(p.x, p.y);
      });
      
      if (mousePosRef.current) {
        const p = worldToScreen(new THREE.Vector3(...mousePosRef.current), cameraRef.current, width, height);
        ctx.lineTo(p.x, p.y);
      }
      
      ctx.stroke();
    }
    
    if (polygonsRef.current && polygonsRef.current.length > 0) {
      polygonsRef.current.forEach((polygon, idx) => {
        if (polygon && polygon.length > 2) {
          ctx.beginPath();
          const start = worldToScreen(new THREE.Vector3(...polygon[0]), cameraRef.current, width, height);
          ctx.moveTo(start.x, start.y);
          
          polygon.slice(1).forEach((point, index) => {
            const p = worldToScreen(new THREE.Vector3(...point), cameraRef.current, width, height);
            ctx.lineTo(p.x, p.y);
          });
          
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 191, 174, 0.3)';
          ctx.fill();
          
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
    
  };

  useEffect(() => {
    redrawCanvas();
  }, [polygons, currentPolygon, mousePos]);

  useEffect(() => {
    if (selectedTool !== 'line' || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const vector = new THREE.Vector3(x, y, 0.5);
      vector.unproject(cameraRef.current);
      
      if (currentPolygon.length === 0) {
        setFirstPoint([vector.x, vector.y, vector.z]);
        setCurrentPolygon([[vector.x, vector.y, vector.z]]);
        return;
      }
      
      if (firstPoint) {
        const [fx, fy, fz] = firstPoint;
        const dist = Math.sqrt(
          Math.pow(vector.x - fx, 2) + Math.pow(vector.y - fy, 2) + Math.pow(vector.z - fz, 2)
        );
        if (dist < 0.01) {
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
    
    const handleMouseMove = (e) => {
      if (currentPolygon.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const vector = new THREE.Vector3(x, y, 0.5);
      vector.unproject(cameraRef.current);
      
      setMousePos([vector.x, vector.y, vector.z]);
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCurrentPolygon([]);
        setIsDrawingPolygon(false);
        setDrawingLine(false);
        setFirstPoint(null);
        setMousePos(null);
      }
    };
    
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

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = selectedTool !== 'line';
  }, [selectedTool]);

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
            touchAction: 'none',  
            backgroundColor: 'rgba(255, 0, 0, 0.1)'  
          }}
        />
        <Button
          className="map-editor-layers-toggle"
          type="primary"
          icon={<MenuOutlined />}
          onClick={() => setShowLayers(!showLayers)}
        />
      </div>

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
                <h3>{t('mapEditor.layersTitle')}</h3>
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
              <h3>{t('mapEditor.propertiesTitle')}</h3>
              {selectedElement && (
                <Form
                  form={form}
                  layout="vertical"
                  onValuesChange={handlePropertiesUpdate}
                >
                  <Form.Item label={t('mapEditor.id')} name="id">
                    <Input disabled />
                  </Form.Item>
                  <Form.Item label={t('mapEditor.type')} name="type">
                    <Select>
                      <Option value="line">{t('mapEditor.lane')}</Option>
                      <Option value="polygon">{t('mapEditor.park')}</Option>
                      <Option value="point">{t('mapEditor.junction')}</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label={t('mapEditor.speedLimit')} name="speedLimit">
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item label={t('mapEditor.direction')} name="direction">
                    <Select>
                      <Option value="forward">{t('mapEditor.forward')}</Option>
                      <Option value="backward">{t('mapEditor.backward')}</Option>
                      <Option value="both">{t('mapEditor.both')}</Option>
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