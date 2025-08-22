import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Space, Dropdown, message } from 'antd';
import { addLogListener, removeLogListener, LOG_TYPES } from '../../assets/js/utils';
import './DebugConsole.css';
import { SearchOutlined } from '@ant-design/icons';
import IpcController from '../../controller/gui/IpcController';
import { useI18n } from '../../context/I18nContext';

const MAX_LOGS = 1000;

const DebugConsole = () => {
  const [debugLogs, setDebugLogs] = useState([]);
  const { t } = useI18n();
  const [filterType, setFilterType] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [isScrollLocked, setIsScrollLocked] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const consoleContentRef = useRef(null);
  const containerHeight = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const ipcListenerSetRef = useRef(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedLog: null });

  const scrollToBottom = useCallback(() => {
    if (consoleContentRef.current && isScrollLocked) {
      const scrollHeight = consoleContentRef.current.scrollHeight;
      consoleContentRef.current.scrollTop = scrollHeight;
      setScrollTop(scrollHeight);
    }
  }, [isScrollLocked]);

  const handleScroll = useCallback((e) => {
    if (!isScrollLocked) {
      setScrollTop(e.target.scrollTop);
    }
  }, [isScrollLocked]);

  const updateContainerHeight = useCallback(() => {
    if (consoleContentRef.current) {
      containerHeight.current = consoleContentRef.current.clientHeight;
    }
  }, []);

  useEffect(() => {
    updateContainerHeight();
    window.addEventListener('resize', updateContainerHeight);
    return () => window.removeEventListener('resize', updateContainerHeight);
  }, [updateContainerHeight]);

  const handleNewLog = useCallback((logEntry) => {
    setDebugLogs(prevLogs => {
      const newLogs = [...prevLogs, logEntry];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(-MAX_LOGS);
      }
      return newLogs;
    });
  }, []);

      const handleNewLogFromIpc = useCallback((event, logEntry) => {
        handleNewLog(logEntry);
      }, [handleNewLog]);

  useEffect(() => {
    if(window.isMainWindow == 1) {
      addLogListener(handleNewLog);

      if (!ipcListenerSetRef.current) {
        IpcController.on('log-message', handleNewLogFromIpc);
        ipcListenerSetRef.current = true;
      }
    }
    
    return () => {
      if(window.isMainWindow == 1) {
        removeLogListener(handleNewLog);
        
        if (ipcListenerSetRef.current) {
          IpcController.off('log-message', handleNewLogFromIpc);
          ipcListenerSetRef.current = false;
        }
      }
    };
  }, [handleNewLog, handleNewLogFromIpc]);

  useEffect(() => {
    scrollToBottom();
  }, [debugLogs, scrollToBottom]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const getLogClass = (type) => {
    switch (type) {
      case LOG_TYPES.INFO:
        return 'log-info';
      case LOG_TYPES.WARNING:
        return 'log-warning';
      case LOG_TYPES.ERROR:
        return 'log-error';
      default:
        return '';
    }
  };

  const handleClear = () => {
    setDebugLogs([]);
  };

  const handleScrollLock = () => {
    setIsScrollLocked(!isScrollLocked);
    if (!isScrollLocked && consoleContentRef.current) {
      const scrollHeight = consoleContentRef.current.scrollHeight;
      consoleContentRef.current.scrollTop = scrollHeight;
      setScrollTop(scrollHeight);
    }
  };

  const filterItems = [
    { key: 'all', label: t('debugConsole.filterAll') },
    { key: LOG_TYPES.INFO, label: t('debugConsole.filterInfo') },
    { key: LOG_TYPES.WARNING, label: t('debugConsole.filterWarning') },
    { key: LOG_TYPES.ERROR, label: t('debugConsole.filterError') },
  ];

  const handleFilterClick = ({ key }) => {
    setFilterType(key);
  };

  const filteredLogs = debugLogs.filter(log => {
    const typeMatch = filterType === 'all' || log.type === filterType;
    const textMatch = !searchText || 
      log.message.toLowerCase().includes(searchText.toLowerCase()) ||
      log.timestamp.includes(searchText);
    return typeMatch && textMatch;
  });

  const handleContextMenu = (e, log) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      selectedLog: log
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, selectedLog: null });
  };

  const copyLogContent = () => {
    if (contextMenu.selectedLog) {
      const logText = `[${contextMenu.selectedLog.timestamp}] ${contextMenu.selectedLog.type.toUpperCase()}: ${contextMenu.selectedLog.message}`;
      navigator.clipboard.writeText(logText).then(() => {
        message.success(t('debugConsole.copySuccess'));
      }).catch(() => {
        message.error(t('debugConsole.copyFailed'));
      });
    }
    closeContextMenu();
  };

  const exportLogs = () => {
    const logsText = filteredLogs.map(log => 
      `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_logs_${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeContextMenu();
  };

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="debug-console">
      <div className="console-header">
        <div className="console-title">{t('debugConsole.title')}</div>
        <Space>
          <div className={`console-search-wrapper${searchOpen ? ' open' : ''}`}> 
            {!searchOpen && (
              <SearchOutlined className="console-search-icon" onClick={() => setSearchOpen(true)} />
            )}
            {searchOpen && (
              <input
                ref={searchInputRef}
                type="text"
                className="console-search-input"
                placeholder={t('debugConsole.searchPlaceholder')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onBlur={() => setSearchOpen(false)}
              />
            )}
          </div>
          <span 
            className={`console-scroll-lock ${isScrollLocked ? 'locked' : ''}`}
            onClick={handleScrollLock}
            title={isScrollLocked ? t('debugConsole.scrollLockOn') : t('debugConsole.scrollLockOff')}
          >
            {isScrollLocked ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 0 1-1.5 0V6.75a3.75 3.75 0 1 0-7.5 0v3a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H3.75a3 3 0 0 1-3-3v-6.75a3 3 0 0 1 3-3h9v-3c0-2.9 2.35-5.25 5.25-5.25Z" />
              </svg>
            )}
          </span>
          <span className="console-clear" onClick={handleClear}>{t('debugConsole.clear')}</span>
          <Dropdown
            menu={{
              items: filterItems,
              onClick: handleFilterClick,
              selectedKeys: [filterType],
            }}
            trigger={['click']}
          >
            <span className="console-filter">
              {t('debugConsole.filter')} {filterType === 'all' ? t('debugConsole.filterAll') : 
                filterType === LOG_TYPES.INFO ? t('debugConsole.filterInfo') :
                filterType === LOG_TYPES.WARNING ? t('debugConsole.filterWarning') : t('debugConsole.filterError')}
            </span>
          </Dropdown>
        </Space>
      </div>
      <div 
        className="console-content" 
        ref={consoleContentRef}
        onScroll={handleScroll}
      >
        {filteredLogs.map((log, index) => (
          <div 
            key={index} 
            className={`console-line ${getLogClass(log.type)}`}
            onContextMenu={(e) => handleContextMenu(e, log)}
          >
            <span className="line-number">{index + 1}</span>
            <span className="line-content">
              <span className="timestamp">[{log.timestamp}]</span>
              <span className={`log-type ${log.type}`}>{log.type.toUpperCase()}</span>
              <span className="message">{log.message}</span>
            </span>
          </div>
        ))}
      </div>
      {contextMenu.visible && (
        <div 
          className="context-menu"
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
        >
          <div 
            className="context-menu-item"
            onClick={copyLogContent}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              color: '#e0e0e0',
              fontSize: '13px',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#3d3d3d'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {t('debugConsole.copy')}
          </div>
          <div 
            className="context-menu-item"
            onClick={exportLogs}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              color: '#e0e0e0',
              fontSize: '13px',
              transition: 'background 0.2s',
              borderTop: '1px solid #444',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#3d3d3d'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {t('debugConsole.exportAll')}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugConsole;