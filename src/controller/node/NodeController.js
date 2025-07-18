const path = window.require('path');
const fs = window.require('fs');
const GLOBALS = require('../../assets/js/globals').default;
const NodeExecutor = require('./NodeExecutor').default;
const CommandExecutor = require('../../assets/js/commandExecutor').default;

class NodeController {
    constructor(setNodeLogs) {
        this.initialized = false;
        this.nodeDir = path.join(GLOBALS.USERDATA_DIR, 'node');
        this.nodeExecutor = new NodeExecutor(setNodeLogs);
    }

    async initialize() {
        if (this.initialized) return;
        if (!fs.existsSync(this.nodeDir)) {
            fs.mkdirSync(this.nodeDir, { recursive: true });
        }
        this.initialized = true;
    }

    async start(nodes, edges) {
        await this.initialize();
        CommandExecutor.deleteAllTempFiles();
        GLOBALS.redisController.deleteAllTaskKeys();
        return this.nodeExecutor.executeFlow(nodes, edges);
    }

    async stop() {
        await this.nodeExecutor.stop();
    }

    async forceStop() {
        await this.nodeExecutor.forceStop();
    }
}

export default NodeController; 