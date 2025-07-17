import NodeScanner from '../node/NodeScanner';
import { log, LOG_TYPES } from '../../assets/js/utils';
import config from '../../assets/js/config';

class GuiController {
    constructor() {
        this.nodeScanner = null;
        this.nodeList = [];
        this.initialized = false;
        this.initializing = false;
    }

    async initialize() {
        if (this.initialized || this.initializing) {
            return;
        }

        this.initializing = true;

        try {
            log('初始化GUI控制器...', LOG_TYPES.INFO);
            
            this.nodeScanner = new NodeScanner();
            
            this.nodeList = await this.scanNodes();
            
            await this.initializeConfig();

            this.initialized = true;
            log('GUI控制器初始化完成', LOG_TYPES.SUCCESS);
        } catch (error) {
            log(`GUI控制器初始化失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    async scanNodes() {
        try {
            log('扫描节点...', LOG_TYPES.INFO);
            const nodes = this.nodeScanner.scanNodes();
            log(`扫描到 ${nodes.length} 个节点`, LOG_TYPES.SUCCESS);
            return nodes;
        } catch (error) {
            log(`节点扫描失败: ${error.message}`, LOG_TYPES.ERROR);
            return [];
        }
    }

    async initializeConfig() {
        try {
            log('初始化配置...', LOG_TYPES.INFO);
            await config.init();
            log('配置初始化完成', LOG_TYPES.SUCCESS);
        } catch (error) {
            log(`配置初始化失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    getNodeList() {
        return this.nodeList;
    }

    isInitialized() {
        return this.initialized;
    }

    isInitializing() {
        return this.initializing;
    }

    reset() {
        this.nodeScanner = null;
        this.nodeList = [];
        this.initialized = false;
        this.initializing = false;
        log('GUI控制器已重置', LOG_TYPES.INFO);
    }
}

const guiController = new GuiController();

export default guiController;