import React, { useState, useEffect } from 'react';
import './NodeConfigModal.css';

const NodeConfigModal = ({ open, node, onClose, onSave }) => {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (node && node.data && node.data.config) {
      // 初始化表单为当前配置值
      const initial = {};
      node.data.config.forEach(item => {
        // 使用当前值，如果没有则使用默认值
        initial[item.name] = item.default_value ?? (item.type === 'number' ? 0 : '');
      });
      setForm(initial);
    }
  }, [node]);

  if (!open || !node) return null;

  const handleChange = (name, value) => {
    // 确保值始终是字符串或数字
    const processedValue = value === '' ? (node.data.config.find(item => item.name === name)?.type === 'number' ? 0 : '') : value;
    setForm(f => ({ ...f, [name]: processedValue }));
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
              <label>{item.name}</label>
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