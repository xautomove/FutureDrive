import React, { useState, useEffect } from 'react';
import './NodeConfigModal.css';
import { Switch, Button } from 'antd';
import fileController from '../../controller/gui/FileController';

const NodeConfigModal = ({ open, node, onClose, onSave }) => {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (node && node.data && node.data.config) {
      const initial = {};
      node.data.config.forEach(item => {
        if (item.type === 'bool') {
          initial[item.name] = item.default_value === 1 ? true : false;
        } else {
          initial[item.name] = item.default_value ?? (item.type === 'number' ? 0 : '');
        }
      });
      setForm(initial);
    }
  }, [node]);

  if (!open || !node) return null;

  const handleChange = (name, value) => {
    const processedValue = value === '' ? (node.data.config.find(item => item.name === name)?.type === 'number' ? 0 : '') : value;
    setForm(f => ({ ...f, [name]: processedValue }));
  };

  const handleFileSelect = async (name) => {
    try {
      const result = await fileController.selectFile({
        title: `选择${name}文件`,
        filters: [
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      if (result.success) {
        setForm(f => ({ ...f, [name]: result.filePath }));
      }
    } catch (error) {
      console.error('选择文件失败:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) onSave(form);
    onClose();
  };

  const renderFormItem = (item) => {
    switch (item.type) {
      case 'number':
        return (
          <input
            type="number"
            value={form[item.name] ?? 0}
            onChange={e => handleChange(item.name, e.target.value)}
          />
        );
      case 'text':
        return (
          <input
            type="text"
            value={form[item.name] ?? ''}
            onChange={e => handleChange(item.name, e.target.value)}
          />
        );
      case 'select':
        return (
          <select
            value={form[item.name] ?? item.default_value}
            onChange={e => handleChange(item.name, e.target.value)}
          >
            {item.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'bool':
        return (
          <div style={{ margin: '8px 0' }}>
            <Switch
              checked={!!form[item.name]}
              onChange={checked => handleChange(item.name, checked)}
            />
          </div>
        );
      case 'file':
        return (
          <div className="file-input-container">
            <input
              type="text"
              value={form[item.name] ?? ''}
              placeholder="请选择文件..."
              readOnly
              className="file-path-input"
            />
            <Button 
              type="default" 
              size="small"
              onClick={() => handleFileSelect(item.name)}
              className="file-select-button"
            >
              选择文件
            </Button>
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={form[item.name] ?? ''}
            onChange={e => handleChange(item.name, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="node-config-modal-overlay" onClick={onClose}>
      <div className="node-config-modal" onClick={e => e.stopPropagation()}>
        <div className="node-config-modal-header">
          <h3>节点配置 - {node.data.label}</h3>
          <button className="node-config-modal-close" onClick={onClose}>×</button>
        </div>
        <form className="node-config-modal-body" onSubmit={handleSubmit}>
          {node.data.config?.map(item => (
            <div className="node-config-form-item" key={item.name}>
              <label>
                {item.name}
                {item.required === 1 || item.required === true ? (
                  <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
                ) : null}
              </label>
              {renderFormItem(item)}
              {item.description && (
                <div className="node-config-form-description">{item.description}</div>
              )}
            </div>
          ))}
          <div className="node-config-modal-footer">
            <button type="button" onClick={onClose}>取消</button>
            <button type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NodeConfigModal; 