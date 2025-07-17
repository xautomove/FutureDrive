const { ipcRenderer } = window.require('electron');

class IpcController {
    constructor() {
        this.initialized = false;
        this.listeners = new Map();
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;
    }

    /**
     * 发送消息到主进程
     * @param {string} channel 通道名称
     * @param {any} data 要发送的数据
     */
    send(channel, data) {
        ipcRenderer.send(channel, data);
    }

    /**
     * 监听来自主进程的消息
     * @param {string} channel 通道名称
     * @param {Function} callback 回调函数
     * @returns {Function} 用于移除监听器的函数
     */
    on(channel, callback) {
        this.removeAllListeners(channel);
        
        const wrappedCallback = (event, data) => {
            callback(event, data);
        };
        
        this.listeners.set(channel, new Set([wrappedCallback]));
        
        ipcRenderer.on(channel, wrappedCallback);

        return () => this.off(channel, wrappedCallback);
    }

    /**
     * 移除特定通道的特定监听器
     * @param {string} channel 通道名称
     * @param {Function} callback 要移除的回调函数
     */
    off(channel, callback) {
        if (this.listeners.has(channel)) {
            this.listeners.get(channel).delete(callback);
            ipcRenderer.removeListener(channel, callback);
        }
    }

    /**
     * 移除特定通道的所有监听器
     * @param {string} channel 通道名称
     */
    removeAllListeners(channel) {
        if (this.listeners.has(channel)) {
            this.listeners.get(channel).clear();
            ipcRenderer.removeAllListeners(channel);
        }
    }
}

export default new IpcController(); 