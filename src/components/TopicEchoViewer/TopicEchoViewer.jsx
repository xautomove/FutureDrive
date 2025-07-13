import React, { useState, useRef, useEffect } from 'react';
import { Input, Checkbox, Space, Button, Select } from 'antd';
import { SearchOutlined, ExportOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import rosController from '../../controller/ros/RosController';
import fileController from '../../controller/gui/FileController';
import { log, LOG_TYPES } from '../../assets/js/utils';
import { message } from 'antd';
import './TopicEchoViewer.css';

const TopicEchoViewer = ({ topic }) => {
  const [output, setOutput] = useState('');
  const [filter, setFilter] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matchCount, setMatchCount] = useState(0);
  const [filteredOutput, setFilteredOutput] = useState('');
  const [mode, setMode] = useState('echo');
  const outputRef = useRef(null);
  const filteredOutputRef = useRef('');
  const echoProcRef = useRef(null);
  const getTopicProcRef = useRef(null);
  const isFirstRender = useRef(true);
  const isStrictModeCheck = useRef(true);

  // 查找所有匹配项的位置
  const findAllMatches = (text, searchText) => {
    const matches = [];
    let index = text.toLowerCase().indexOf(searchText.toLowerCase());
    while (index !== -1) {
      matches.push(index);
      index = text.toLowerCase().indexOf(searchText.toLowerCase(), index + 1);
    }
    return matches;
  };

  // 滚动到指定位置
  const scrollToPosition = (index) => {
    if (index === -1 || !outputRef.current) return;

    const text = outputRef.current.value;
    const lines = text.substring(0, index).split('\n');
    const lineHeight = 20; // 假设每行高度为20px
    outputRef.current.scrollTop = (lines.length - 1) * lineHeight;
  };

  // 导航到上一个匹配项
  const goToPreviousMatch = () => {
    if (matchCount === 0) return;
    const newIndex = currentMatchIndex > 0 ? currentMatchIndex - 1 : matchCount - 1;
    setCurrentMatchIndex(newIndex);
    const matches = findAllMatches(filteredOutputRef.current, filter);
    scrollToPosition(matches[newIndex]);
  };

  // 导航到下一个匹配项
  const goToNextMatch = () => {
    if (matchCount === 0) return;
    const newIndex = currentMatchIndex < matchCount - 1 ? currentMatchIndex + 1 : 0;
    setCurrentMatchIndex(newIndex);
    const matches = findAllMatches(filteredOutputRef.current, filter);
    scrollToPosition(matches[newIndex]);
  };

  // 新增: 非echo模式下请求话题信息
  const requestGetTopic = () => {
    if (getTopicProcRef.current) {
      try { getTopicProcRef.current.kill(); } catch {}
      getTopicProcRef.current = null;
    }
    setOutput('');
    rosController.getTopic(topic, mode, (text) => {
      setOutput(prev => prev + text + '\n');
    }).then(proc => {
      getTopicProcRef.current = proc;
    });
  };

  // 监听isAutoScroll变化
  useEffect(() => {
    if (mode !== 'echo') return;
    if (isStrictModeCheck.current) {
      isStrictModeCheck.current = false;
      return;
    }
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // 初始加载时手动触发一次请求
      requestEcho(!isAutoScroll);
      return;
    }
    requestEcho(!isAutoScroll);
  }, [isAutoScroll, topic, mode]);

  // 组件加载时触发初始请求
  useEffect(() => {
    // 切换mode/topic时清理所有进程
    if (echoProcRef.current) {
      try { echoProcRef.current.kill(); } catch {}
      echoProcRef.current = null;
    }
    if (getTopicProcRef.current) {
      try { getTopicProcRef.current.kill(); } catch {}
      getTopicProcRef.current = null;
    }
    setOutput('');
    if (mode === 'echo') {
      requestEcho(!isAutoScroll);
    } else {
      requestGetTopic();
    }
    return () => {
      if (echoProcRef.current) {
        try { echoProcRef.current.kill(); } catch {}
        echoProcRef.current = null;
      }
      if (getTopicProcRef.current) {
        try { getTopicProcRef.current.kill(); } catch {}
        getTopicProcRef.current = null;
      }
    };
  }, [mode, topic]);

  // 处理自动滚动
  useEffect(() => {
    if (!isSearching && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, isSearching]);

  // 过滤输出
  useEffect(() => {
    if (filter) {
      const lines = output.split('\n');
      const filtered = lines.filter(line =>
        line.toLowerCase().includes(filter.toLowerCase())
      ).join('\n');
      filteredOutputRef.current = filtered;
      setFilteredOutput(filtered);
      setIsSearching(true);

      // 更新匹配信息
      const matches = findAllMatches(filtered, filter);
      setMatchCount(matches.length);
      if (matches.length > 0) {
        setCurrentMatchIndex(0);
        scrollToPosition(matches[0]);
      } else {
        setCurrentMatchIndex(-1);
      }
    } else {
      filteredOutputRef.current = output;
      setFilteredOutput(output);
      setIsSearching(false);
      setMatchCount(0);
      setCurrentMatchIndex(-1);
    }
  }, [output, filter]);

  
  // 添加导出功能
  const handleExport = async () => {
    try {
      const content = filteredOutputRef.current;
      // 生成更简洁的文件名：话题名_年月日_时分秒.txt
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 19).replace(/[T:]/g, '');
      const defaultPath = `${topic.replace(/\//g, '_')}_${dateStr}.txt`;

      console.log("导出文件", defaultPath);
      const result = await fileController.showSaveDialog({
        defaultPath,
        filters: [
          { name: 'Text Files', extensions: ['txt'] }
        ]
      });

      if (result.success) {
        const writeResult = fileController.writeFile(result.filePath, content);
        if (!writeResult.success) {
          console.error('保存文件失败:', writeResult.error);
          log(`保存文件失败: ${writeResult.error}`, LOG_TYPES.ERROR);
          return;
        }
        log(`导出成功: ${result.filePath}`, LOG_TYPES.SUCCESS);
        message.success('导出成功');
      }
    } catch (error) {
      console.error('导出失败:', error);
      log(`导出失败: ${error.message}`, LOG_TYPES.ERROR);
    }
  };

  // 请求话题数据
  const requestEcho = (once = false) => {
    try {
      if (echoProcRef.current) {
        try { echoProcRef.current.kill(); } catch { }
        echoProcRef.current = null;
      }
      var proc = null;
      if (once) {
        proc = rosController.echoTopic(topic, true, (text) => {
          setOutput(prev => prev + text + '\n');
        });
        if (proc) {
          echoProcRef.current = proc;
        }
      } else {
        proc = rosController.echoTopic(topic, false, (text) => {
          setOutput(prev => prev + text + '\n');
        });
        if (proc) {
          echoProcRef.current = proc;
        }
      }
      if (!proc) {
        message.error('获取数据失败');
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      log(`获取数据失败: ${error.message}`, LOG_TYPES.ERROR);
    }
  };

  return (
    <div className="topic-echo-viewer-root">
      <div className="topic-echo-viewer-toolbar">
        <span className="topic-echo-viewer-title">话题: {topic}</span>
        <Space>
          <Select
            value={mode}
            onChange={setMode}
            style={{ width: 90 }}
            options={[
              { value: 'echo', label: 'echo' },
              { value: 'delay', label: 'delay' },
              { value: 'hz', label: 'hz' },
              { value: 'info', label: 'info' },
              { value: 'type', label: 'type' },
            ]}
            size="small"
          />
          <Input
            className="topic-echo-viewer-filter"
            placeholder="过滤内容..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
          {isSearching && matchCount > 0 && (
            <Space>
              <Button
                icon={<UpOutlined />}
                onClick={goToPreviousMatch}
                size="small"
              />
              <span>{currentMatchIndex + 1}/{matchCount}</span>
              <Button
                icon={<DownOutlined />}
                onClick={goToNextMatch}
                size="small"
              />
            </Space>
          )}
          {mode === 'echo' && (
            <Checkbox
              checked={isAutoScroll}
              onChange={e => setIsAutoScroll(e.target.checked)}
            >
              自动更新
            </Checkbox>
          )}
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      </div>
      <div className="topic-echo-viewer-output-wrapper">
        <textarea
          ref={outputRef}
          className="topic-echo-viewer-output"
          value={filteredOutput}
          readOnly
        />
      </div>
    </div>
  );
};

export default TopicEchoViewer; 