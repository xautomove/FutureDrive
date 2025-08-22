import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Tabs } from 'antd';
import { SearchOutlined, ReloadOutlined, FolderOpenOutlined,ShoppingCartOutlined } from '@ant-design/icons';
import './NodeListModal.css';
import GLOBALS from '../../assets/js/globals';
import NodeScanner from '../../controller/node/NodeScanner';
import { message } from 'antd'; 
import { useI18n } from '../../context/I18nContext';
const { shell } = window.require ? window.require('electron') : require('electron');
const path = window.require('path');

const NodeListModal = ({ isOpen, onClose, nodes, onNodeSelect }) => {
  const { t } = useI18n();
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const nodeScanner = new NodeScanner();

  const updateNodeList = (nodeList) => {
    if (nodeList && nodeList.length > 0) {
      const types = [...new Set(nodeList.map(node => node.data.type || 'other'))];
      const tabItems = [
        {
          key: 'all',
          label: t('nodeList.tabAll'),
          children: renderNodeList(nodeList)
        },
        ...types.map(type => ({
          key: type,
          label: type,
          children: renderNodeList(nodeList.filter(node => (node.data.type || 'other') === type))
        }))
      ];
      setTabs(tabItems);
      if (!tabItems.find(tab => tab.key === activeTab)) {
        setActiveTab('all');
      }
    } else {
      setTabs([]);
      setActiveTab('all');
    }
  };

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    updateNodeList(nodes);
  }, [nodes, searchText]);

  const handleOpenNodeDir = (nodeName) => {
    const nodePath = path.join(GLOBALS.USERDATA_DIR, nodeName);
    shell.openPath(nodePath);
  };

  const handleRefreshNodes = () => {
    try {
      const newNodes = nodeScanner.scanNodes();
      setTabs([]);
      setActiveTab('all');
      updateNodeList(newNodes);
      message.success(t('nodeList.refreshSuccess'));
    } catch (error) {
      message.error(t('nodeList.refreshFailed'));
    }
  };

  const renderNodeList = (nodeList) => {
    const filteredList = nodeList.filter(node => {
      if (!searchText) return true;
      const searchLower = searchText.toLowerCase();
      return (
        node.data.name.toLowerCase().includes(searchLower) ||
        (node.data.description && node.data.description.toLowerCase().includes(searchLower))
      );
    });

    return (
      <div className="node-list">
        {filteredList.map((node, index) => (
          <div key={index} className="node-item">
            <div className="node-info">
              <span className="node-name">{node.data.name}</span>
              <span className="node-path">{node.data.description}</span>
            </div>
            <span className="node-type" onClick={() => onNodeSelect(node)}>{t('nodeList.add')}</span>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="node-list-modal-wrapper">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="header-content">
              <h2>可用节点列表</h2>
              <div className="header-buttons">
                <button
                  className="icon-button"
                  onClick={() => handleOpenNodeDir('node')}
                  title="打开节点目录"
                >
                  <FolderOpenOutlined />
                </button>
                <button
                  className="icon-button"
                  onClick={handleRefreshNodes}
                  title="刷新节点列表"
                >
                  <ReloadOutlined />
                </button>
                <button
                  className="icon-button"
                  onClick={() => shell.openExternal('https://market.automoves.cn/')}
                  title="市场"
                >
                   <ShoppingCartOutlined />
                </button>
              </div>
            </div>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabs}
              tabBarExtraContent={{
                right: (
                  <div className={`search-wrapper${searchOpen ? ' open' : ''}`}>
                    {!searchOpen && (
                      <SearchOutlined className="search-icon" onClick={() => setSearchOpen(true)} />
                    )}
                    {searchOpen && (
                      <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="搜索节点..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        onBlur={() => setSearchOpen(false)}
                      />
                    )}
                  </div>
                )
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NodeListModal;
