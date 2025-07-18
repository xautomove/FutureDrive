const { app } = window.require('@electron/remote');
const path = window.require('path');

const activeProcesses = [];

const GLOBALS = {
  USERDATA_DIR: path.join(app.getPath('userData'), 'FutureDrive'),
  isDebug: false,
  nodeLogs: [],
  activeProcesses,
  debugWatchers: [],
  redisController: null,
  nodeController: null,

  addProcess(nodeId, process) {
    this.activeProcesses.push({ nodeId, process });
  },

  removeProcess(nodeId) {
    const index = this.activeProcesses.findIndex(item => item.nodeId === nodeId);
    if (index !== -1) {
      this.activeProcesses.splice(index, 1);
    }
  },

  clearProcesses() {
    this.activeProcesses = [];
  },

  stopDebugWatcher(uuid) {
    const idx = this.debugWatchers.findIndex(w => w.uuid === uuid);
    if (idx !== -1) {
      clearInterval(this.debugWatchers[idx].intervalId);
      this.debugWatchers.splice(idx, 1);
    }
  },
  stopAllDebugWatchers() {
    this.debugWatchers.forEach(w => clearInterval(w.intervalId));
    this.debugWatchers = [];
  }
};

export default GLOBALS; 