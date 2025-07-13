const { ipcRenderer } = require('electron');

class WindowController {
  constructor() {
    this.windows = {};
  }

  async openViewer(w,h,page, params = {}) {
    // 通过IPC触发窗口创建
    await ipcRenderer.invoke('open_window', w, h, page, params);
  }
}

module.exports = new WindowController();