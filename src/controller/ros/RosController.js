import commandExecutor from '../../assets/js/commandExecutor';
import { log, LOG_TYPES } from '../../assets/js/utils';

class RosController {
    constructor() {
        this.initialized = false;
        this._lastEchoProc = null;
        this._lastGetTopicProc = null;
    }

    async initialize() {
        if (this.initialized) return;
        this.initialized = true;
    }

    async start() {
        await this.initialize();
    }

    async stop() {
    }

    /**
     * 获取话题列表
     * @returns {Promise<string[]>} 话题列表
     */
    async getTopicList() {
        try {
            const result = await commandExecutor.execute('ros2', ['topic', 'list'], {
                onStdout: (text) => log(`获取话题列表: ${text}`, LOG_TYPES.INFO),
                onStderr: (text) => log(`获取话题列表错误: ${text}`, LOG_TYPES.ERROR),
            });
            
            if (!result || typeof result !== 'object' || !result.stdout) {
                log('获取失败: ${result.stderr}', LOG_TYPES.ERROR);
                return [];
            }

            const output = typeof result.stdout === 'string' ? result.stdout : String(result.stdout);
            
            return output.split('\n')
                .map(topic => topic.trim())
                .filter(topic => topic);
        } catch (error) {
            log(`获取话题列表失败: ${error.message}`, LOG_TYPES.ERROR);
            return [];
        }
    }

    /**
     * 获取话题信息
     * @param {string} topic 话题名称
     * @returns {Promise<string>} 话题信息
     */
    async getTopicInfo(topic) {
        try {
            const result = await commandExecutor.execute('ros2', ['topic', 'info', topic], {
                onStdout: (text) => log(`获取话题信息: ${text}`, LOG_TYPES.INFO),
                onStderr: (text) => log(`获取话题信息错误: ${text}`, LOG_TYPES.ERROR),
            });
            return result.stdout;
        } catch (error) {
            log(`获取话题信息失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    /**
     * 获取话题的 frame_id
     * @param {string} topic 话题名称
     * @returns {Promise<string|null>} frame_id
     */
    async getTopicFrameId(topic) {
        try {
            const result = await commandExecutor.execute('ros2', ['topic', 'echo', topic, '--once'], {
                onStdout: (text) => log(`获取话题数据: ${text}`, LOG_TYPES.INFO),
                onStderr: (text) => log(`获取话题数据错误: ${text}`, LOG_TYPES.ERROR),
            });
            const frameIdMatch = result.stdout.match(/"frame_id":\s*"([^"]+)"/);
            return frameIdMatch ? frameIdMatch[1] : null;
        } catch (error) {
            log(`获取话题 frame_id 失败: ${error.message}`, LOG_TYPES.ERROR);
            return null;
        }
    }

    /**
     * 录制rosbag
     * @param {string[]} topics 话题数组
     * @param {string} outputPath 保存路径
     * @param {function} onStdout 输出回调
     * @param {function} onStderr 错误回调
     * @returns {Promise<ChildProcess>} 进程对象
     */
    async rosBagRecord(topics, outputPath, onStdout, onStderr) {
        const args = ['bag', 'record', ...topics, '--output', outputPath];
        return new Promise((resolve, reject) => {
            let started = false;
            const procPromise = commandExecutor.execute('ros2', args, {
                onStdout: (text) => {
                    if (onStdout) onStdout(text);
                    if (!started && text.includes('Recording...')) {
                        started = true;
                        procPromise.then(result => resolve(result.child));
                    }
                },
                onStderr: onStderr,
                onError: reject,
            });
            procPromise.catch(reject);
        });
    }

    /**
     * 停止rosbag录制
     * @param {ChildProcess} proc 进程对象
     */
    stopRosBagRecord(proc) {
        if (proc) {
            try {
                proc.kill('SIGINT');
                log('rosbag录制已停止', LOG_TYPES.INFO);
            } catch (e) {
                log('停止rosbag录制失败: ' + e.message, LOG_TYPES.ERROR);
            }
        }
    }

    /**
     * 获取话题内容（echo），自动结束上一次进程，支持持续和一次性输出
     * @param {string} topic 话题名
     * @param {boolean} once 是否只获取一次
     * @param {function} onData 数据回调（可选）
     * @returns {Promise<string>|ChildProcess} 输出内容或进程对象
     */
    async echoTopic(topic, once = false, onData) {
        try{
            if (this._lastEchoProc) {
                try { 
                    this._lastEchoProc.kill('SIGKILL'); 
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch {}
                this._lastEchoProc = null;
            }
            const args = ['topic', 'echo', topic];
            if (once) {
                let output = '';
                const result = await commandExecutor.execute('ros2', args.concat(['--once']), {
                    onStdout: (text) => {
                        output += text;
                        if (onData) onData(text);
                    },
                    onError: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                    onStderr: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                });
                return output;
            } else {
                const child = commandExecutor.executeFlow('ros2', args, {
                    onStdout: onData,
                    onError: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                    onStderr: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                });
                this._lastEchoProc = child;
                return child;
            }
        } catch (error) {
            log(`获取话题数据失败: ${error.message}`, LOG_TYPES.ERROR);
            return null;
        }
    }

    /**
     * 执行ros2命令
     * @param {string} topic 话题名
     * @param {string} type 执行命令类型
     * @param {function} onData 数据回调（可选）
     * @returns {Promise<string>|ChildProcess} 输出内容或进程对象
     */
    async getTopic(topic, type, onData) {
        try {
            if (this._lastGetTopicProc) {
                try { 
                    this._lastGetTopicProc.kill('SIGKILL'); 
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch {}
                this._lastGetTopicProc = null;
            }
            const args = ['topic', type, topic];
            if (["hz", "delay"].includes(type)) {
                const child = commandExecutor.executeFlow('ros2', args, {
                    onStdout: onData,
                    onError: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                    onStderr: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                });
                this._lastGetTopicProc = child;
                return child;
            } else {
                let output = '';
                const result = await commandExecutor.execute('ros2', args, {
                    onStdout: (text) => {
                        output += text;
                        if (onData) onData(text);
                    },
                    onError: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                    onStderr: (error) => {
                        console.error(`获取话题数据失败: ${error.message}`);
                    },
                });
                return output;
            }
        } catch (error) {
            log(`获取话题数据失败: ${error.message}`, LOG_TYPES.ERROR);
            return null;
        }
    }
}

export default new RosController(); 