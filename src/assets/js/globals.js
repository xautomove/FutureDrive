const { app } = window.require('@electron/remote');
const path = window.require('path');
const EventEmitter = require('events');

// 创建全局事件发射器
const globalEmitter = new EventEmitter();

// 进程管理列表
const activeProcesses = [];

// 全局变量管理
const GLOBALS = {
  // 全局用户数据目录
  USERDATA_DIR: path.join(app.getPath('userData'), 'FutuDrive'),
  // 全局NodeController实例
  nodeController: null,
  // 活动进程列表
  activeProcesses,
  // 其它全局变量可在此添加

  // 获取运行状态
  get isRunning() {
    return this.activeProcesses.length > 0;
  },

  // 获取当前运行的节点ID列表
  get runningNodeIds() {
    return this.activeProcesses.map(item => item.nodeId);
  },

  // 清空所有进程
  clearProcesses() {
    this.activeProcesses = [];
    globalEmitter.emit('runningStateChanged', this.isRunning);
    globalEmitter.emit('runningNodesChanged', []);
  },

  // 添加事件监听
  onRunningStateChange(callback) {
    globalEmitter.on('runningStateChanged', callback);
    // 初始状态
    callback(this.isRunning);
    // 返回清理函数
    return () => globalEmitter.off('runningStateChanged', callback);
  },

  // 监听运行节点变化
  onRunningNodesChange(callback) {
    globalEmitter.on('runningNodesChanged', callback);
    // 初始状态
    callback(this.runningNodeIds);
    // 返回清理函数
    return () => globalEmitter.off('runningNodesChanged', callback);
  },

  // 添加进程
  addProcess(nodeId, process) {
    this.activeProcesses.push({ nodeId, process });
    globalEmitter.emit('runningStateChanged', this.isRunning);
    globalEmitter.emit('runningNodesChanged', this.runningNodeIds);
  },

  // 移除进程
  removeProcess(nodeId) {
    const index = this.activeProcesses.findIndex(item => item.nodeId === nodeId);
    if (index !== -1) {
      this.activeProcesses.splice(index, 1);
      globalEmitter.emit('runningStateChanged', this.isRunning);
      globalEmitter.emit('runningNodesChanged', this.runningNodeIds);
    }
  }
};

export default GLOBALS; 