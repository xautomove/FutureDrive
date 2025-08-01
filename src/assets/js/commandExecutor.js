import { spawn } from 'child_process';
import { log, LOG_TYPES } from './utils';
import path from 'path';
import fs from 'fs';
import GLOBALS from './globals';

class CommandExecutor {
    constructor() {
        this.tempDir = path.join(GLOBALS.USERDATA_DIR, 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * 添加进程到全局管理
     * @param {string} nodeId - 节点ID
     * @param {ChildProcess} process - 子进程实例
     */
    addProcess(nodeId, process) {
        GLOBALS.addProcess(nodeId, process);
    }

    /**
     * 从全局管理中移除进程
     * @param {string} nodeId - 节点ID
     */
    removeProcess(nodeId) {
        GLOBALS.removeProcess(nodeId);
    }

    /**
     * 执行命令
     * @param {string} command - 命令
     * @param {string[]} args - 命令参数数组
     * @param {Object} options - 执行选项
     * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} 执行结果
     */
    async execute(command, args = [], options = {}) {
        try {
            const {
                nodeId,
                env = {},
                onStdout = (text) => {
                    if(GLOBALS.isDebug){
                        log(`Command stdout: ${text}`, LOG_TYPES.INFO)
                    }
                },
                onStderr = (text) => {
                    if(GLOBALS.isDebug){
                        log(`Command stderr: ${text}`, LOG_TYPES.INFO)
                    }
                },
                onError = (error) => {
                    if(GLOBALS.isDebug){
                        log(`Command error: ${error}`, LOG_TYPES.ERROR)
                    }
                },
                isTaskNode = false,
                ...otherOptions
            } = options;

            return new Promise((resolve, reject) => {

                const fullCommand = `${command} ${args.join(' ')}`;
                if(GLOBALS.isDebug){
                    log(`执行命令: ${fullCommand}`, LOG_TYPES.INFO);
                }

                const child = spawn(command, args, {
                    env: {
                        ...process.env,
                        ...env
                    },
                    ...otherOptions
                });

                if (nodeId) {
                    this.addProcess(nodeId, child);
                }

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    const text = data.toString('utf8');
                    stdout += text;
                    onStdout(text);
                });

                child.stderr.on('data', (data) => {
                    const text = data.toString('utf8');
                    stderr += text;
                    onStderr(text);
                });

                child.on('close', (code) => {
                    if (!isTaskNode || code !== 0) {
                        if (nodeId) {
                            this.removeProcess(nodeId);
                        }
                    }
                    
                    if (code === 0) {
                        resolve({
                            stdout,
                            stderr,
                            exitCode: code
                        });
                    } else {
                        if (GLOBALS.isRunning) {
                            reject(new Error(`退出码: ${code}`));
                        }
                    }
                });

                child.on('error', (error) => {
                    if (nodeId) {
                        this.removeProcess(nodeId);
                    }
                    
                    if (typeof onError === 'function') {
                        onError(error);
                    }
                    reject(error);
                });
            });
        } catch (error) {
            if (typeof onError === 'function') {
                onError(error);
            }
            throw error;
        }
    }

    /**
     * 创建临时文件
     * @param {string} content - 文件内容
     * @param {string} extension - 文件扩展名
     * @returns {string} 临时文件路径
     */
    createTempFile(content, extension = '') {
        const tempFilePath = path.join(this.tempDir, `temp_${Date.now()}${extension}`);
        fs.writeFileSync(tempFilePath, content, 'utf8');
        return tempFilePath;
    }

    /**
     * 删除临时文件
     * @param {string} filePath - 文件路径
     */
    deleteTempFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            log(`删除临时文件失败: ${error.message}`, LOG_TYPES.WARNING);
        }
    }

    deleteAllTempFiles() {
        try{
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                this.deleteTempFile(path.join(this.tempDir, file));
            });
        }catch(e){
            log(`清空缓存文件失败: ${e.message}`, LOG_TYPES.WARNING);
        }
        
    }

    /**
     * 强制终止所有活动进程
     */
    killActiveProcess() {
        for (const { nodeId, process } of GLOBALS.activeProcesses) {
            try {
                if (process && typeof process.kill === 'function') {
                    process.kill('SIGKILL');
                }
            } catch (e) {
                log(`强制终止节点 ${nodeId} 的进程失败: ${e.message}`, LOG_TYPES.ERROR);
            }
        }
        GLOBALS.clearProcesses();
        log('已强制终止所有进程', LOG_TYPES.WARNING);
    }

    /**
     * 持续化运行命令，返回进程对象（适合流式输出/需手动kill的场景）
     * @param {string} command
     * @param {string[]} args
     * @param {Object} options
     * @returns {ChildProcess}
     */
    executeFlow(command, args = [], options = {}) {
        try {
            const { onStdout, onStderr, onError, env = {}, ...otherOptions } = options;
            
            const fullCommand = `${command} ${args.join(' ')}`;
            if(GLOBALS.isDebug){
                log(`执行命令: ${fullCommand}`, LOG_TYPES.INFO);
            }

            const child = spawn(command, args, {
                env: { ...process.env, ...env },
                ...otherOptions
            });

            if (onStdout) {
                child.stdout.on('data', (data) => onStdout(data.toString('utf8')));
            }
            if (onStderr) {
                child.stderr.on('data', (data) => onStderr(data.toString('utf8')));
            }
            
            const handleError = (error) => {
                if(GLOBALS.isDebug){
                    log(`命令执行错误: ${error.message}`, LOG_TYPES.ERROR);
                }
                if (onError) {
                    onError(error);
                }
            };

            child.on('error', handleError);

            child.on('close', (code) => {
                if (code !== 0) {
                   if(GLOBALS.isDebug){
                    log(`命令执行结束，退出码: ${code}`, LOG_TYPES.WARNING);
                   }
                }
            });

            return child;
        } catch (error) {
            if(GLOBALS.isDebug){
                log(`创建进程失败: ${error.message}`, LOG_TYPES.ERROR);
            }
            if (options.onError) {
                options.onError(error);
            }
            throw error;
        }
    }
}

export default new CommandExecutor(); 