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
        // 先移除该channel的所有旧监听器
        this.removeAllListeners(channel);
        
        // 创建一个包装函数，用于存储和移除
        const wrappedCallback = (event, data) => {
            callback(event, data);
        };
        
        // 存储监听器信息
        this.listeners.set(channel, new Set([wrappedCallback]));
        
        // 添加新监听器
        ipcRenderer.on(channel, wrappedCallback);

        // 返回移除监听器的函数
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