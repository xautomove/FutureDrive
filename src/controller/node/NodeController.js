const path = window.require('path');
const fs = window.require('fs');
const GLOBALS = require('../../assets/js/globals').default;
const NodeExecutor = require('./NodeExecutor').default;
const CommandExecutor = require('../../assets/js/commandExecutor').default;
const config = require('../../assets/js/config').default;
const { log, LOG_TYPES } = require('../../assets/js/utils');

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
        
        const backgroundTaskUuids = await this.checkBackgroundTasks();
        if (backgroundTaskUuids.length > 0) {
            const userChoice = await this.promptForceStop();
            if (userChoice === 'cancel') {
                log('用户取消启动，保留后台任务', LOG_TYPES.INFO);
                if (GLOBALS.onStartupComplete) {
                    GLOBALS.onStartupComplete();
                }
                return;
            } else if (userChoice === 'stopOnly') {
                await this.forceStopAllBackgroundTasks(backgroundTaskUuids);
                GLOBALS.redisController.deleteAllTaskKeys();
                await new Promise(resolve => setTimeout(resolve, 600));
                log('后台任务已结束，但未启动工作流', LOG_TYPES.INFO);
                if (GLOBALS.onStartupComplete) {
                    GLOBALS.onStartupComplete();
                }
                return;
            }
            await this.forceStopAllBackgroundTasks(backgroundTaskUuids);
            await new Promise(resolve => setTimeout(resolve, 600));
        }
        
        CommandExecutor.deleteAllTempFiles();
        GLOBALS.redisController.deleteAllTaskKeys();
        
        try {
            const { app } = window.require('@electron/remote');
            const systemConfig = {
                redis: config.get('redis') || {},
                debug: config.get('debug') || false,
                systemInfo: config.get('systemInfo') || {},
                version: app.getVersion(),
                projectPath: window.currentProject?.path || '',
                projectName: window.currentProject?.config?.name || '',
                appPath: app.getAppPath(),
                userDataPath: app.getPath('userData'),
                tempPath: app.getPath('temp'),
                homePath: app.getPath('home')
            };
            
            await GLOBALS.redisController.set('future_config', JSON.stringify(systemConfig));
        } catch (error) {
            console.error('写入系统配置到Redis失败:', error);
        }
        
        if (GLOBALS.onStartupComplete) {
            GLOBALS.onStartupComplete();
        }
        
        return this.nodeExecutor.executeFlow(nodes, edges);
    }

    async stop() {
        await this.nodeExecutor.stop();
    }

    async forceStop() {
        await this.nodeExecutor.forceStop();
    }

    /**
     * 检查是否有后台运行的任务节点
     * @returns {Promise<string[]>} 返回需要结束的后台任务UUID列表
     */
    async checkBackgroundTasks() {
        try {
            if (!GLOBALS.redisController || !GLOBALS.redisController.isConnected()) {
                return [];
            }
            
            const bgKeys = await GLOBALS.redisController.keys('task_bg:*');
            const runningBgTaskUuids = [];

            for (const key of bgKeys) {
                let bgStatus = await GLOBALS.redisController.get(key);
                bgStatus = String(bgStatus);
                if (bgStatus === '1') {
                    const uuid = key.replace('task_bg:', '');
                    runningBgTaskUuids.push(uuid);
                }
            }
            
            return runningBgTaskUuids;
        } catch (error) {
            console.error('检查后台任务失败:', error);
            return [];
        }
    }

    /**
     * 提示用户是否强制结束后台任务
     */
    async promptForceStop() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #2d2d2d;
                border: 1px solid #444;
                border-radius: 8px;
                padding: 24px;
                min-width: 400px;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            
            modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 16px;">发现后台运行的任务</h3>
                <p style="margin: 0 0 24px 0; color: #ccc; font-size: 14px;">检测到有后台任务正在运行，请选择操作：</p>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button id="cancel-btn" style="
                        background: #363636;
                        border: 1px solid #444;
                        color: #fff;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">取消</button>
                    <button id="stop-only-btn" style="
                        background: #363636;
                        border: 1px solid #444;
                        color: #fff;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">仅结束后台任务</button>
                    <button id="start-btn" style="
                        background: #1976d2;
                        border: 1px solid #1976d2;
                        color: #fff;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">强制结束并启动</button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // 添加事件监听器
            document.getElementById('cancel-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve('cancel');
            });
            
            document.getElementById('stop-only-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve('stopOnly');
            });
            
            document.getElementById('start-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve('start');
            });
            
            // 点击遮罩层关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve('cancel');
                }
            });
        });
    }

    /**
     * 强制结束指定的后台任务
     * @param {string[]} taskUuids 需要结束的任务UUID列表
     */
    async forceStopAllBackgroundTasks(taskUuids) {
        try {
            log('开始强制结束所有后台任务...', LOG_TYPES.INFO);
            
            for (const uuid of taskUuids) {
                await GLOBALS.redisController.set(`task_stop:${uuid}`, '1');
                
                const pid = await GLOBALS.redisController.get(`task_pid:${uuid}`);
                if (pid) {
                    const pidStr = String(pid);
                    let pidList = [];
                    
                    if (pidStr.includes(',')) {
                        pidList = pidStr.split(',').map(p => p.trim()).filter(p => p);
                    } else {
                        pidList = [pidStr];
                    }
                    
                    for (const singlePid of pidList) {
                        try {
                            process.kill(Number(singlePid), 'SIGKILL');
                        } catch (e) {
                        }
                    }
                }
            }
            
            GLOBALS.clearProcesses();
            GLOBALS.stopAllDebugWatchers();
            
            GLOBALS.nodeLogs.forEach(logEntry => {
                logEntry.hasBackgroundProcess = false;
            });
            
            log('所有后台任务已强制结束', LOG_TYPES.SUCCESS);
        } catch (error) {
            log(`强制结束后台任务失败: ${error.message}`, LOG_TYPES.ERROR);
        }
    }
}

export default NodeController; 