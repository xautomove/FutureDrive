import path from 'path';
import fs from 'fs';
import GLOBALS from '../../assets/js/globals';
import { log, LOG_TYPES } from '../../assets/js/utils';
import commandExecutor from '../../assets/js/commandExecutor';
import config from '../../assets/js/config';
import globals from '../../assets/js/globals';

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

            let scriptContent = 'aW1wb3J0IHN5cwppbXBvcnQganNvbgppbXBvcnQgaW1wb3J0bGliLnV0aWwKaW1wb3J0IG9zCmltcG9ydCBsb2NhbGUKaW1wb3J0IGluc3BlY3QKaW1wb3J0IHJlZGlzCgpvcy5lbnZpcm9uWydQWVRIT05JT0VOQ09ESU5HJ10gPSAndXRmLTgnCmlmIHN5cy5wbGF0Zm9ybSA9PSAnd2luMzInOgogICAgdHJ5OgogICAgICAgIGxvY2FsZS5zZXRsb2NhbGUobG9jYWxlLkxDX0FMTCwgJ2VuX1VTLlVURi04JykKICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgdHJ5OgogICAgICAgICAgICBsb2NhbGUuc2V0bG9jYWxlKGxvY2FsZS5MQ19BTEwsICdFbmdsaXNoX1VuaXRlZCBTdGF0ZXMuVVRGLTgnKQogICAgICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgICAgIHBhc3MKCnN5cy5zdGRvdXQucmVjb25maWd1cmUoZW5jb2Rpbmc9J3V0Zi04JykKc3lzLnN0ZGVyci5yZWNvbmZpZ3VyZShlbmNvZGluZz0ndXRmLTgnKQoKY2xhc3MgUmVkaXNDYWNoZToKICAgIGRlZiBfX2luaXRfXyhzZWxmLCBob3N0PSdsb2NhbGhvc3QnLCBwb3J0PTYzNzksIGRiPTApOgogICAgICAgIHNlbGYuY2xpZW50ID0gcmVkaXMuUmVkaXMoaG9zdD1ob3N0LCBwb3J0PXBvcnQsIGRiPWRiKQoKICAgIGRlZiBzZXQoc2VsZiwga2V5LCB2YWx1ZSwgZXg9Tm9uZSk6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LnNldChrZXksIHZhbHVlLCBleD1leCkKCiAgICBkZWYgZ2V0KHNlbGYsIGtleSk6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LmdldChrZXkpCgogICAgZGVmIGRlbGV0ZShzZWxmLCBrZXkpOgogICAgICAgIHJldHVybiBzZWxmLmNsaWVudC5kZWxldGUoa2V5KQoKICAgIGRlZiBleGlzdHMoc2VsZiwga2V5KToKICAgICAgICByZXR1cm4gc2VsZi5jbGllbnQuZXhpc3RzKGtleSkKCiAgICBkZWYgZmx1c2goc2VsZik6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LmZsdXNoZGIoKQoKc3BlYyA9IGltcG9ydGxpYi51dGlsLnNwZWNfZnJvbV9maWxlX2xvY2F0aW9uKCJtYWluIiwgInttYWluUGF0aH0iKQptYWluID0gaW1wb3J0bGliLnV0aWwubW9kdWxlX2Zyb21fc3BlYyhzcGVjKQpzcGVjLmxvYWRlci5leGVjX21vZHVsZShtYWluKQoKY2FjaGUgPSBSZWRpc0NhY2hlKCkKCk1haW5Ob2RlQ2xhc3MgPSBtYWluLk1haW5Ob2RlCnNpZ25hdHVyZSA9IGluc3BlY3Quc2lnbmF0dXJlKE1haW5Ob2RlQ2xhc3MuX19pbml0X18pCmlmICdjYWNoZScgaW4gc2lnbmF0dXJlLnBhcmFtZXRlcnM6CiAgICBub2RlID0gTWFpbk5vZGVDbGFzcyhjYWNoZT1jYWNoZSkKZWxzZToKICAgIG5vZGUgPSBNYWluTm9kZUNsYXNzKCkKCmlucHV0X2RhdGEgPSBqc29uLmxvYWRzKCd7aW5wdXRfZGF0YX0nKQpjb25maWdfZGF0YSA9IGpzb24ubG9hZHMoJ3tjb25maWdfZGF0YX0nKQpub2RlLmdldF91c2VyX2lucHV0KGNvbmZpZ19kYXRhKQpub2RlLmdldF9ub2RlX2lucHV0KGlucHV0X2RhdGEpCnJlc3VsdCA9IG5vZGUuZXhlY3V0ZSgpCnRyeToKICAgIHByaW50KGpzb24uZHVtcHMocmVzdWx0LCBlbnN1cmVfYXNjaWk9RmFsc2UpLCBmaWxlPXN5cy5zdGRvdXQpCmV4Y2VwdCBFeGNlcHRpb246CiAgICBwcmludChqc29uLmR1bXBzKFsnZXJyb3InLCAn6I635Y+W57uT5p6c5aSx6LSl77yM6L+U5Zue57uT5p6E5pyJ6K+vJ10sIGVuc3VyZV9hc2NpaT1GYWxzZSksIGZpbGU9c3lzLnN0ZGVycik='
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
                const { stderr, stdout } = await commandExecutor.execute(pythonPath, ['-u', tempScriptPath], {
                    nodeId: node.id,
                    env: cleanEnv,
                    onStdout: (text) => {
                        if(globals.isDebug){
                            log(`节点输出: ${text}`, LOG_TYPES.INFO)
                        }
                    },
                    onStderr: (text) => {
                        if(globals.isDebug){
                            log(`节点错误: ${text}`, LOG_TYPES.ERROR)
                        }
                    },
                    onError: (error) => {
                        if (error.message.includes('ENOENT')) {
                            throw new Error('Python 未安装或未添加到系统环境变量中。请安装 Python 并确保将其添加到系统环境变量。');
                        }
                        throw error;
                    }
                });

                if(stderr !== ''){
                    throw new Error(stderr);
                }
                let filteredStdout = stdout
                    .split('\n')
                    .filter(line => !line.trim().startsWith('#'))
                    .join('\n');
                console.log('filteredStdout', filteredStdout);
                return JSON.parse(filteredStdout);
            } finally {
                commandExecutor.deleteTempFile(tempScriptPath);
            }

        } catch (error) {
            throw error;
        }
    }

    killActiveProcess() {
        commandExecutor.killActiveProcess();
    }
}

export default PythonNodeExecutor; 