const { app } = window.require('@electron/remote');
const path = window.require('path');
const fs = window.require('fs');
const GLOBALS = require('../../assets/js/globals').default;
const NodeExecutor = require('./NodeExecutor').default;

class NodeController {
    constructor() {
        this.initialized = false;
        this.nodeDir = path.join(GLOBALS.USERDATA_DIR, 'node');
        this.nodeExecutor = new NodeExecutor();
    }

    async initialize() {
        if (this.initialized) return;
        // 确保节点目录存在
        if (!fs.existsSync(this.nodeDir)) {
            fs.mkdirSync(this.nodeDir, { recursive: true });
        }
        this.initialized = true;
    }

    // 执行流程
    async start(nodes, edges) {
        await this.initialize();
        return this.nodeExecutor.executeFlow(nodes, edges);
    }

    // 停止执行
    async stop() {
        await this.nodeExecutor.stop();
    }

    // 强制停止执行
    async forceStop() {
        console.log('forceStop1');
        await this.nodeExecutor.forceStop();
    }
}

export default NodeController; 