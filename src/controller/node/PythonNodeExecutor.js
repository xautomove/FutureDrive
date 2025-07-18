import path from 'path';
import fs from 'fs';
import GLOBALS from '../../assets/js/globals';
import { log, LOG_TYPES } from '../../assets/js/utils';
import commandExecutor from '../../assets/js/commandExecutor';
import config from '../../assets/js/config';

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

            let pythonCode = 'aW1wb3J0IHN5cwppbXBvcnQganNvbgppbXBvcnQgaW1wb3J0bGliLnV0aWwKaW1wb3J0IG9zCmltcG9ydCBsb2NhbGUKaW1wb3J0IGluc3BlY3QKaW1wb3J0IHJlZGlzCgpvcy5lbnZpcm9uWydQWVRIT05JT0VOQ09ESU5HJ10gPSAndXRmLTgnCmlmIHN5cy5wbGF0Zm9ybSA9PSAnd2luMzInOgogICAgdHJ5OgogICAgICAgIGxvY2FsZS5zZXRsb2NhbGUobG9jYWxlLkxDX0FMTCwgJ2VuX1VTLlVURi04JykKICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgdHJ5OgogICAgICAgICAgICBsb2NhbGUuc2V0bG9jYWxlKGxvY2FsZS5MQ19BTEwsICdFbmdsaXNoX1VuaXRlZCBTdGF0ZXMuVVRGLTgnKQogICAgICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgICAgIHBhc3MKCnN5cy5zdGRvdXQucmVjb25maWd1cmUoZW5jb2Rpbmc9J3V0Zi04JykKc3lzLnN0ZGVyci5yZWNvbmZpZ3VyZShlbmNvZGluZz0ndXRmLTgnKQoKY2xhc3MgUmVkaXNDYWNoZToKICAgIGRlZiBfX2luaXRfXyhzZWxmLCBob3N0PSdsb2NhbGhvc3QnLCBwb3J0PTYzNzksIGRiPTApOgogICAgICAgIHNlbGYuY2xpZW50ID0gcmVkaXMuUmVkaXMoaG9zdD1ob3N0LCBwb3J0PXBvcnQsIGRiPWRiKQoKICAgIGRlZiBzZXQoc2VsZiwga2V5LCB2YWx1ZSwgZXg9Tm9uZSk6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LnNldChrZXksIHZhbHVlLCBleD1leCkKCiAgICBkZWYgZ2V0KHNlbGYsIGtleSk6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LmdldChrZXkpCgogICAgZGVmIGRlbGV0ZShzZWxmLCBrZXkpOgogICAgICAgIHJldHVybiBzZWxmLmNsaWVudC5kZWxldGUoa2V5KQoKICAgIGRlZiBleGlzdHMoc2VsZiwga2V5KToKICAgICAgICByZXR1cm4gc2VsZi5jbGllbnQuZXhpc3RzKGtleSkKCiAgICBkZWYgZmx1c2goc2VsZik6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LmZsdXNoZGIoKQoKIyB1dWlk5o+Q5YmN5a6a5LmJCnV1aWRfdmFsdWUgPSAne3V1aWR9JwoKIyDlsIHoo4XkuIDkuKrlv6vmjbfnvJPlrZjnsbvvvIzkvKDpgJJzZGsKY2xhc3MgTm9kZUNhY2hlSGVscGVyOgogICAgZGVmIF9faW5pdF9fKHNlbGYsIHJlZGlzX2NhY2hlLCB1dWlkKToKICAgICAgICBzZWxmLnJlZGlzX2NhY2hlID0gcmVkaXNfY2FjaGUKICAgICAgICBzZWxmLnV1aWQgPSB1dWlkCgogICAgZGVmIGRlYnVnKHNlbGYsIHZhbHVlKToKICAgICAgICAjIOaUr+aMgeWkmuenjeexu+Wei++8jOacgOe7iOi9rOaIkOWtl+espuS4suWtmOWCqO+8jOW5tui/veWKoOWIsOWOn+WGheWuuQogICAgICAgIGtleSA9IGYidGFza19kZWJ1Zzp7c2VsZi51dWlkfSIKICAgICAgICB0cnk6CiAgICAgICAgICAgIGlmIGlzaW5zdGFuY2UodmFsdWUsIHN0cik6CiAgICAgICAgICAgICAgICBzdHJfdmFsdWUgPSB2YWx1ZQogICAgICAgICAgICBlbHNlOgogICAgICAgICAgICAgICAgc3RyX3ZhbHVlID0ganNvbi5kdW1wcyh2YWx1ZSwgZW5zdXJlX2FzY2lpPUZhbHNlKQogICAgICAgIGV4Y2VwdCBFeGNlcHRpb246CiAgICAgICAgICAgIHN0cl92YWx1ZSA9IHN0cih2YWx1ZSkKICAgICAgICAjIOWFiOivu+WPluWOn+WGheWuuQogICAgICAgIG9sZF92YWx1ZSA9IHNlbGYucmVkaXNfY2FjaGUuZ2V0KGtleSkKICAgICAgICBpZiBvbGRfdmFsdWUgaXMgbm90IE5vbmU6CiAgICAgICAgICAgIHRyeToKICAgICAgICAgICAgICAgIG9sZF92YWx1ZSA9IG9sZF92YWx1ZS5kZWNvZGUoJ3V0Zi04JykKICAgICAgICAgICAgZXhjZXB0IEV4Y2VwdGlvbjoKICAgICAgICAgICAgICAgIG9sZF92YWx1ZSA9IHN0cihvbGRfdmFsdWUpCiAgICAgICAgICAgIG5ld192YWx1ZSA9IG9sZF92YWx1ZSArICJcbiIgKyBzdHJfdmFsdWUKICAgICAgICBlbHNlOgogICAgICAgICAgICBuZXdfdmFsdWUgPSBzdHJfdmFsdWUKICAgICAgICBzZWxmLnJlZGlzX2NhY2hlLnNldChrZXksIG5ld192YWx1ZSkKCiAgICBkZWYgb3V0cHV0KHNlbGYsIHZhbHVlKToKICAgICAgICAjIOWmguaenOaYr+Wtl+WFuO+8jOWFiOi9rOaIkGpzb27lrZfnrKbkuLLlho3lrZjlgqgKICAgICAgICBrZXkgPSBmInRhc2tfcmVzdWx0OntzZWxmLnV1aWR9IgogICAgICAgIGlmIGlzaW5zdGFuY2UodmFsdWUsIGRpY3QpOgogICAgICAgICAgICB0cnk6CiAgICAgICAgICAgICAgICB2YWx1ZSA9IGpzb24uZHVtcHModmFsdWUsIGVuc3VyZV9hc2NpaT1GYWxzZSkKICAgICAgICAgICAgZXhjZXB0IEV4Y2VwdGlvbjoKICAgICAgICAgICAgICAgIHZhbHVlID0gc3RyKHZhbHVlKQogICAgICAgIHNlbGYucmVkaXNfY2FjaGUuc2V0KGtleSwgdmFsdWUpCgogICAgZGVmIGZpbmlzaChzZWxmKToKICAgICAgICBrZXkgPSBmInRhc2tfc3RhdHVzOntzZWxmLnV1aWR9IgogICAgICAgIHNlbGYucmVkaXNfY2FjaGUuc2V0KGtleSwgImZpbmlzaCIpCgogICAgZGVmIGVycm9yKHNlbGYpOgogICAgICAgIGtleSA9IGYidGFza19zdGF0dXM6e3NlbGYudXVpZH0iCiAgICAgICAgc2VsZi5yZWRpc19jYWNoZS5zZXQoa2V5LCAiZXJyb3IiKQoKICAgIGRlZiBiZyhzZWxmLCB2YWx1ZSk6CiAgICAgICAga2V5ID0gZiJ0YXNrX2JnOntzZWxmLnV1aWR9IgogICAgICAgIHNlbGYucmVkaXNfY2FjaGUuc2V0KGtleSwgaW50KHZhbHVlKSkKCiAgICBkZWYgaXNfc3RvcChzZWxmKToKICAgICAgICBrZXkgPSBmInRhc2tfc3RvcDp7c2VsZi51dWlkfSIKICAgICAgICBzdG9wID0gc2VsZi5yZWRpc19jYWNoZS5nZXQoa2V5KQogICAgICAgIGlmIHN0b3AgaXMgbm90IE5vbmUgYW5kIHN0b3AgPT0gJzEnOgogICAgICAgICAgICByZXR1cm4gVHJ1ZQogICAgICAgIHJldHVybiBGYWxzZQogICAgCiAgICBkZWYgc2F2ZV9waWQoc2VsZik6CiAgICAgICAgIiIiCiAgICAgICAg6I635Y+W5b2T5YmN6L+b56iLcGlk77yM5bm26L+95Yqg5YiwIHRhc2tfcGlkOnt1dWlkfSDnmoTliJfooajkuK0KICAgICAgICAiIiIKICAgICAgICBpbXBvcnQgb3MKICAgICAgICBrZXkgPSBmInRhc2tfcGlkOntzZWxmLnV1aWR9IgogICAgICAgIHBpZCA9IG9zLmdldHBpZCgpCiAgICAgICAgc2VsZi5yZWRpc19jYWNoZS5zZXQoa2V5LCBwaWQpCgpzcGVjID0gaW1wb3J0bGliLnV0aWwuc3BlY19mcm9tX2ZpbGVfbG9jYXRpb24oIm1haW4iLCAie21haW5QYXRofSIpCm1haW4gPSBpbXBvcnRsaWIudXRpbC5tb2R1bGVfZnJvbV9zcGVjKHNwZWMpCnNwZWMubG9hZGVyLmV4ZWNfbW9kdWxlKG1haW4pCgpjYWNoZSA9IFJlZGlzQ2FjaGUoJ3tob3N0fScsIHtwb3J0fSwge2RifSkKbm9kZV9jYWNoZV9oZWxwZXIgPSBOb2RlQ2FjaGVIZWxwZXIoY2FjaGUsIHV1aWRfdmFsdWUpCm5vZGVfY2FjaGVfaGVscGVyLnNhdmVfcGlkKCkKCm5vZGUgPSBtYWluLk1haW5Ob2RlKGNhY2hlPWNhY2hlLCB1dWlkPXV1aWRfdmFsdWUsIHNkaz1ub2RlX2NhY2hlX2hlbHBlcikKCmlucHV0X2RhdGEgPSBqc29uLmxvYWRzKCd7aW5wdXRfZGF0YX0nKQpjb25maWdfZGF0YSA9IGpzb24ubG9hZHMoJ3tjb25maWdfZGF0YX0nKQppZiBoYXNhdHRyKG5vZGUsICdnZXRfdXNlcl9pbnB1dCcpOgogICAgbm9kZS5nZXRfdXNlcl9pbnB1dChjb25maWdfZGF0YSkKaWYgaGFzYXR0cihub2RlLCAnZ2V0X25vZGVfaW5wdXQnKToKICAgIG5vZGUuZ2V0X25vZGVfaW5wdXQoaW5wdXRfZGF0YSkKbm9kZS5leGVjdXRlKCk='
            pythonCode = Buffer.from(pythonCode, 'base64').toString('utf-8');
            pythonCode = pythonCode.replace('{mainPath}', mainPath.replace(/\\/g, '\\\\'))
                .replace('{uuid}', node.data.uuid || '')
                .replace('{input_data}', JSON.stringify(realInputData))
                .replace('{config_data}', JSON.stringify(configData))
                .replace('{host}', config.get('redis')?.host || 'localhost')
                .replace('{port}', config.get('redis')?.port || 6379)
                .replace('{db}', config.get('redis')?.db || 0);
            const tempScriptPath = commandExecutor.createTempFile(pythonCode, '.py');

            let pythonPath = config.get('node')?.pythonPath;
            if (!pythonPath) {
                pythonPath = 'python3';
            }

            const cleanEnv = {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8',
                LD_LIBRARY_PATH: '/opt/ros/humble/lib:/usr/lib/x86_64-linux-gnu',
                LD_PRELOAD: '/usr/lib/x86_64-linux-gnu/libstdc++.so.6'
            };

            const child = commandExecutor.executeFlow(pythonPath, ['-u', tempScriptPath], {
                nodeId: node.id,
                env: cleanEnv,
                onStdout: (text) => {
                    if(GLOBALS.isDebug){
                        log(`节点输出: ${text}`, LOG_TYPES.INFO)
                    }
                },
                onStderr: (text) => {
                    if(GLOBALS.isDebug){
                        log(`节点错误: ${text}`, LOG_TYPES.ERROR)
                    }
                },
                onError: (error) => {
                    commandExecutor.deleteTempFile(tempScriptPath);
                    log(`节点进程错误: ${error.message}`, LOG_TYPES.ERROR);
                }
            });
            return child;
        } catch (error) {
            commandExecutor.deleteTempFile(tempScriptPath);
            log(`启动节点进程失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    killActiveProcess() {
        commandExecutor.killActiveProcess();
    }
}

export default PythonNodeExecutor; 