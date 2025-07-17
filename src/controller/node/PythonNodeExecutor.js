import path from 'path';
import fs from 'fs';
import GLOBALS from '../../assets/js/globals';
import { log, LOG_TYPES } from '../../assets/js/utils';
import commandExecutor from '../../assets/js/commandExecutor';
import config from '../../assets/js/config';
import { env } from 'process';

class PythonNodeExecutor {
    constructor() {
        this.tempDir = path.join(GLOBALS.USERDATA_DIR, 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async execute(node, inputData, configData) {
        try {
            const nodePath = path.join(GLOBALS.USERDATA_DIR, 'node', node.path);
            const mainPath = path.join(nodePath, 'main.py');
            const configPath = path.join(nodePath, 'config.json');

            let nodeConfig = null;
            if (fs.existsSync(configPath)) {
                nodeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            let realInputData = { ...inputData };
            if (nodeConfig && nodeConfig.parameters && Array.isArray(nodeConfig.parameters.inputs)) {
                for (const input of nodeConfig.parameters.inputs) {
                    const name = input.name;
                    if (realInputData[name] === undefined || realInputData[name] === null) {
                        if ('default_value' in input) {
                            realInputData[name] = input.default_value;
                        }
                    }
                }
            }
            log(`开始执行节点: ${node.data.label}`, LOG_TYPES.INFO);
            console.log('node', node);

            let scriptContent = 'aW1wb3J0IHN5cwppbXBvcnQganNvbgppbXBvcnQgaW1wb3J0bGliLnV0aWwKaW1wb3J0IG9zCmltcG9ydCBsb2NhbGUKCgpvcy5lbnZpcm9uWydQWVRIT05JT0VOQ09ESU5HJ10gPSAndXRmLTgnCmlmIHN5cy5wbGF0Zm9ybSA9PSAnd2luMzInOgogICAgdHJ5OgogICAgICAgIGxvY2FsZS5zZXRsb2NhbGUobG9jYWxlLkxDX0FMTCwgJ2VuX1VTLlVURi04JykKICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgdHJ5OgogICAgICAgICAgICBsb2NhbGUuc2V0bG9jYWxlKGxvY2FsZS5MQ19BTEwsICdFbmdsaXNoX1VuaXRlZCBTdGF0ZXMuVVRGLTgnKQogICAgICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgICAgIHBhc3MKCnN5cy5zdGRvdXQucmVjb25maWd1cmUoZW5jb2Rpbmc9J3V0Zi04JykKc3lzLnN0ZGVyci5yZWNvbmZpZ3VyZShlbmNvZGluZz0ndXRmLTgnKQoKc3BlYyA9IGltcG9ydGxpYi51dGlsLnNwZWNfZnJvbV9maWxlX2xvY2F0aW9uKCJtYWluIiwgInttYWluUGF0aH0iKQptYWluID0gaW1wb3J0bGliLnV0aWwubW9kdWxlX2Zyb21fc3BlYyhzcGVjKQpzcGVjLmxvYWRlci5leGVjX21vZHVsZShtYWluKQoKbm9kZSA9IG1haW4uTWFpbk5vZGUoKQoKaW5wdXRfZGF0YSA9IGpzb24ubG9hZHMoJ3tpbnB1dF9kYXRhfScpCmNvbmZpZ19kYXRhID0ganNvbi5sb2Fkcygne2NvbmZpZ19kYXRhfScpCm5vZGUuZ2V0X3VzZXJfaW5wdXQoY29uZmlnX2RhdGEpCnJlc3VsdCA9IG5vZGUuZXhlY3V0ZSgpCnByaW50KGpzb24uZHVtcHMocmVzdWx0LCBlbnN1cmVfYXNjaWk9RmFsc2UpLCBmaWxlPXN5cy5zdGRlcnIpCg==';
            let pythonCode = Buffer.from(scriptContent, 'base64').toString('utf-8');
            pythonCode = pythonCode
                .replace('{mainPath}', mainPath.replace(/\\/g, '\\\\'))
                .replace('{input_data}', JSON.stringify(realInputData))
                .replace('{config_data}', JSON.stringify(configData));
            const tempScriptPath = commandExecutor.createTempFile(pythonCode, '.py');

            let pythonPath = config.get('node')?.pythonPath;
            if (!pythonPath) {
                pythonPath = 'python3';
            }

            try {

                const cleanEnv = {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8',
                    LANG: 'en_US.UTF-8',
                    LC_ALL: 'en_US.UTF-8',
                    LD_LIBRARY_PATH: '/opt/ros/humble/lib:/usr/lib/x86_64-linux-gnu',
                    LD_PRELOAD: '/usr/lib/x86_64-linux-gnu/libstdc++.so.6'
                };
                const { stderr } = await commandExecutor.execute(pythonPath, ['-u', tempScriptPath], {
                    nodeId: node.id,
                    env: cleanEnv,
                    onStdout: (text) => log(`Python stdout: ${text}`, LOG_TYPES.INFO),
                    onStderr: (text) => log(`Python stderr: ${text}`, LOG_TYPES.INFO),
                    onError: (error) => {
                        if (error.message.includes('ENOENT')) {
                            throw new Error('Python 未安装或未添加到系统环境变量中。请安装 Python 并确保将其添加到系统环境变量。');
                        }
                        throw error;
                    }
                });

                const resultMatch = stderr.match(/\{[\s\S]*\}/);
                if (resultMatch) {
                    return JSON.parse(resultMatch[0]);
                } else {
                    throw new Error('无法解析 Python 输出结果');
                }
            } finally {
                commandExecutor.deleteTempFile(tempScriptPath);
            }

        } catch (error) {
            log(`执行节点失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    killActiveProcess() {
        commandExecutor.killActiveProcess();
    }
}

export default PythonNodeExecutor; 