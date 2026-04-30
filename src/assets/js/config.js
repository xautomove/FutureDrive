import { log, LOG_TYPES } from "./utils";
import GLOBALS from './globals';

const { app } = window.require('@electron/remote');
const fs = window.require('fs');
const path = window.require('path');

class Config {
    constructor() {
        if (!fs.existsSync(GLOBALS.USERDATA_DIR)) {
            fs.mkdirSync(GLOBALS.USERDATA_DIR, { recursive: true });
        }
        this.configDir = path.join(GLOBALS.USERDATA_DIR, 'config');
        this.configPath = path.join(this.configDir, 'config.json');
        this.data = null;
        this.initialized = false;
        this.initPromise = null;
        this.cache = new Map();
    }

    async init() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            if (!fs.existsSync(this.configPath)) {
                this.data = this.getDefaultConfig();
                await this.save();
            } else {
                await this.load();
            }

            this.initialized = true;
            log(`init config success`, LOG_TYPES.INFO);
        })();

        return this.initPromise;
    }

    getDefaultConfig() {
        const { app } = window.require('@electron/remote');
        return {
            "version": app.getVersion(),
            "workflow": {
                "name": "workflow",
                "description": "workflow description",
                "nodes": []
            },
            "environment": {
                "listUrl": "https://future.api.automoves.cn/api/environments/list"
            },
            "debug": false,
            "systemInfo": null,
            "redis": {
                "host": "localhost",
                "port": 6379,
                "password": null,
                "db": 0,
                "enabled": false
            },
            "api": {
                "host": "127.0.0.1",
                "port": 2200,
                "tokenEnabled": false,
                "token": ""
            },
            "startup": {
                "autoLaunchFutureDrive": false,
                "autoRunWorkflow": false,
                "projectPath": "",
                "projectFile": "",
                "templateFile": "",
                "ui": {
                    "enabled": false,
                    "executablePath": ""
                }
            },
            "other": {
                "noUi": false
            },
            'api_server':{
                "host": "https://future.api.automoves.cn",
                "logs_add":"/api/logs/add"
            }
        };
    }

    async checkVersion() {
        await this.init();
        const currentVersion = this.get('version');
        const { app } = window.require('@electron/remote');
        const newVersion = app.getVersion();

        console.log(`当前配置版本: ${currentVersion || '无'}, 应用版本: ${newVersion}`);
        
        if (!currentVersion) {
            log(`首次运行，设置版本号为: ${newVersion}`, LOG_TYPES.INFO);
            this.data.version = newVersion;
            await this.save();
        } else if (currentVersion !== newVersion) {
            // 检测到版本升级
            log(`检测到版本升级: ${currentVersion} -> ${newVersion}`, LOG_TYPES.INFO);
            await this.reset();
            this.data.version = newVersion;
            await this.save();
        } else {
            log(`版本未变化: ${newVersion}`, LOG_TYPES.INFO);
        }
    }

    async load() {
        try {
            const data = await fs.promises.readFile(this.configPath, 'utf8');
            this.data = this.normalizeConfig(JSON.parse(data));
            this.cache.clear();
            this.cache.set('workflow', this.data.workflow);
        } catch (error) {
            console.error('Error loading config:', error);
            this.data = this.getDefaultConfig();
        }
    }

    async save() {
        try {
            this.cache.forEach((value, key) => {
                this.setNestedValue(this.data, key, value);
            });

            await fs.promises.writeFile(
                this.configPath,
                JSON.stringify(this.data, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    get(key) {
        if (!this.initialized) {
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }
            return '';
        }

        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const value = !key ? this.data : this.getNestedValue(this.data, key);
        if (value !== undefined) {
            this.cache.set(key, value);
        }
        return value;
    }

    async set(key, value) {
        if (!this.initialized) {
            this.cache.set(key, value);
            return;
        }
        this.setNestedValue(this.data, key, value);
        this.cache.set(key, value);
        await this.save();
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    async reset() {
        this.data = this.getDefaultConfig();
        this.cache.clear();
        await this.save();
    }

    normalizeConfig(rawConfig = {}) {
        const defaultConfig = this.getDefaultConfig();
        const startupConfig = rawConfig.startup || {};
        const legacyCarUi = startupConfig.carUi || {};
        const uiConfig = startupConfig.ui || {};

        return {
            ...defaultConfig,
            ...rawConfig,
            startup: {
                ...defaultConfig.startup,
                ...startupConfig,
                projectPath: startupConfig.projectPath || '',
                projectFile: startupConfig.projectFile || '',
                templateFile: startupConfig.templateFile || '',
                ui: {
                    ...defaultConfig.startup.ui,
                    enabled: Boolean(uiConfig.enabled ?? legacyCarUi.enabled ?? false),
                    executablePath: uiConfig.executablePath || legacyCarUi.command || ''
                }
            },
            other: {
                ...defaultConfig.other,
                ...(rawConfig.other || {})
            }
        };
    }
}

const config = new Config();
export default config;
