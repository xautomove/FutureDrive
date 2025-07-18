const redis = require('redis');
const { log, LOG_TYPES } = require('../../assets/js/utils');

class RedisController {
    constructor() {
        this.client = null;
        this.connected = false;
        this.config = {
            host: 'localhost',
            port: 6379,
            password: null,
            db: 0,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: null
        };
    }

    /**
     * 初始化 Redis 连接
     * @param {Object} config - Redis 配置
     * @returns {Promise<boolean>} 连接是否成功
     */
    async initialize(config = {}) {
        try {
            // 合并配置
            this.config = { ...this.config, ...config };
            
            // 创建 Redis 客户端
            this.client = redis.createClient({
                socket: {
                    host: this.config.host,
                    port: this.config.port
                },
                password: this.config.password,
                database: this.config.db,
                retryDelayOnFailover: this.config.retryDelayOnFailover,
                enableReadyCheck: this.config.enableReadyCheck,
                maxRetriesPerRequest: this.config.maxRetriesPerRequest
            });

            // 监听连接事件
            // this.client.on('connect', () => {
            //     console.log('Redis 连接中...');
            // });

            this.client.on('ready', () => {
                console.log('Redis 连接就绪');
                this.connected = true;
            });

            this.client.on('error', (err) => {
                console.error('Redis 连接错误:', err);
                this.connected = false;
            });

            this.client.on('end', () => {
                console.log('Redis 连接已断开');
                this.connected = false;
            });

            // 连接 Redis
            await this.client.connect();
            return true;
        } catch (error) {
            log(`Redis 初始化失败: ${error.message}`, LOG_TYPES.ERROR);
            this.connected = false;
            return false;
        }
    }

    /**
     * 检查连接状态
     * @returns {boolean} 是否已连接
     */
    isConnected() {
        return this.connected && this.client;
    }

    /**
     * 删除所有以 task_ 开头的 key
     * @returns {Promise<number>} 删除的 key 数量
     */
    async deleteAllTaskKeys() {
        if (!this.isConnected()) {
            throw new Error('Redis 未连接');
        }
    
        let cursor = '0';
        let deletedCount = 0;
    
        do {
            const result = await this.client.scan(cursor, {
                MATCH: 'task_*',
                COUNT: 100
            });
    
            cursor = result.cursor;
            const keys = result.keys;
    
            if (keys.length > 0) {
                await this.client.del(...keys.map(k => String(k)));
                deletedCount += keys.length;
            }
        } while (cursor !== '0');
    
        return deletedCount;
    }
    

    /**
     * 设置缓存
     * @param {string} key - 键
     * @param {any} value - 值
     * @param {number} ttl - 过期时间（秒），可选
     * @returns {Promise<boolean>} 是否设置成功
     */
    async set(key, value, ttl = null) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            
            if (ttl) {
                await this.client.setEx(key, ttl, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }
            
            return true;
        } catch (error) {
            log(`Redis 设置缓存失败: ${error.message}`, LOG_TYPES.ERROR);
            return false;
        }
    }

    /**
     * 获取缓存
     * @param {string} key - 键
     * @returns {Promise<any>} 值
     */
    async get(key) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const value = await this.client.get(key);
            if (value === null) {
                return null;
            }

            // 尝试解析 JSON
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (error) {
            log(`Redis 获取缓存失败: ${error.message}`, LOG_TYPES.ERROR);
            return null;
        }
    }

    /**
     * 删除缓存
     * @param {string} key - 键
     * @returns {Promise<boolean>} 是否删除成功
     */
    async del(key) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const result = await this.client.del(key);
            return result > 0;
        } catch (error) {
            log(`Redis 删除缓存失败: ${error.message}`, LOG_TYPES.ERROR);
            return false;
        }
    }

    /**
     * 检查键是否存在
     * @param {string} key - 键
     * @returns {Promise<boolean>} 是否存在
     */
    async exists(key) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const result = await this.client.exists(key);
            return result > 0;
        } catch (error) {
            log(`Redis 检查键存在失败: ${error.message}`, LOG_TYPES.ERROR);
            return false;
        }
    }

    /**
     * 设置过期时间
     * @param {string} key - 键
     * @param {number} ttl - 过期时间（秒）
     * @returns {Promise<boolean>} 是否设置成功
     */
    async expire(key, ttl) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const result = await this.client.expire(key, ttl);
            return result > 0;
        } catch (error) {
            log(`Redis 设置过期时间失败: ${error.message}`, LOG_TYPES.ERROR);
            return false;
        }
    }

    /**
     * 获取剩余过期时间
     * @param {string} key - 键
     * @returns {Promise<number>} 剩余秒数，-1表示永不过期，-2表示键不存在
     */
    async ttl(key) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            return await this.client.ttl(key);
        } catch (error) {
            log(`Redis 获取过期时间失败: ${error.message}`, LOG_TYPES.ERROR);
            return -2;
        }
    }

    /**
     * 批量设置缓存
     * @param {Object} data - 键值对对象
     * @param {number} ttl - 过期时间（秒），可选
     * @returns {Promise<boolean>} 是否设置成功
     */
    async mset(data, ttl = null) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const pipeline = this.client.multi();
            
            for (const [key, value] of Object.entries(data)) {
                const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                
                if (ttl) {
                    pipeline.setEx(key, ttl, stringValue);
                } else {
                    pipeline.set(key, stringValue);
                }
            }

            await pipeline.exec();
            return true;
        } catch (error) {
            log(`Redis 批量设置缓存失败: ${error.message}`, LOG_TYPES.ERROR);
            return false;
        }
    }

    /**
     * 批量获取缓存
     * @param {Array<string>} keys - 键数组
     * @returns {Promise<Object>} 键值对对象
     */
    async mget(keys) {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const values = await this.client.mGet(keys);
            const result = {};

            keys.forEach((key, index) => {
                const value = values[index];
                if (value !== null) {
                    try {
                        result[key] = JSON.parse(value);
                    } catch {
                        result[key] = value;
                    }
                } else {
                    result[key] = null;
                }
            });

            return result;
        } catch (error) {
            log(`Redis 批量获取缓存失败: ${error.message}`, LOG_TYPES.ERROR);
            return {};
        }
    }

    /**
     * 获取所有匹配的键
     * @param {string} pattern - 匹配模式
     * @returns {Promise<Array<string>>} 键数组
     */
    async keys(pattern = '*') {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            return await this.client.keys(pattern);
        } catch (error) {
            log(`Redis 获取键列表失败: ${error.message}`, LOG_TYPES.ERROR);
            return [];
        }
    }

    /**
     * 清空当前数据库
     * @returns {Promise<boolean>} 是否清空成功
     */
    async flushdb() {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            await this.client.flushDb();
            return true;
        } catch (error) {
            log(`Redis 清空数据库失败: ${error.message}`, LOG_TYPES.ERROR);
            return false;
        }
    }

    /**
     * 获取数据库信息
     * @returns {Promise<Object>} 数据库信息
     */
    async info() {
        try {
            if (!this.isConnected()) {
                throw new Error('Redis 未连接');
            }

            const info = await this.client.info();
            return this.parseInfo(info);
        } catch (error) {
            log(`Redis 获取信息失败: ${error.message}`, LOG_TYPES.ERROR);
            return {};
        }
    }

    /**
     * 解析 Redis INFO 命令的输出
     * @param {string} info - INFO 命令输出
     * @returns {Object} 解析后的信息对象
     */
    parseInfo(info) {
        const lines = info.split('\r\n');
        const result = {};
        let currentSection = '';

        lines.forEach(line => {
            if (line.startsWith('#')) {
                currentSection = line.substring(1).trim();
                result[currentSection] = {};
            } else if (line.includes(':')) {
                const [key, value] = line.split(':');
                if (currentSection) {
                    result[currentSection][key] = value;
                } else {
                    result[key] = value;
                }
            }
        });

        return result;
    }

    /**
     * 断开连接
     * @returns {Promise<void>}
     */
    async disconnect() {
        try {
            if (this.client) {
                await this.client.quit();
                this.client = null;
                this.connected = false;
                log(`Redis 断开连接成功`, LOG_TYPES.SUCCESS);
            }
        } catch (error) {
            log(`Redis 断开连接失败: ${error.message}`, LOG_TYPES.ERROR);
        }
    }

    /**
     * 重新连接
     * @returns {Promise<boolean>} 是否重连成功
     */
    async reconnect() {
        await this.disconnect();
        return await this.initialize(this.config);
    }
}

export default RedisController; 