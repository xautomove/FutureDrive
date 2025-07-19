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

            // 移除重复的日志，避免与NodeExecutor中的日志重复

            let pythonCode = 'aW1wb3J0IHN5cwppbXBvcnQganNvbgppbXBvcnQgaW1wb3J0bGliLnV0aWwKaW1wb3J0IG9zCmltcG9ydCBsb2NhbGUKaW1wb3J0IGluc3BlY3QKaW1wb3J0IHJlZGlzCgpvcy5lbnZpcm9uWydQWVRIT05JT0VOQ09ESU5HJ10gPSAndXRmLTgnCmlmIHN5cy5wbGF0Zm9ybSA9PSAnd2luMzInOgogICAgdHJ5OgogICAgICAgIGxvY2FsZS5zZXRsb2NhbGUobG9jYWxlLkxDX0FMTCwgJ2VuX1VTLlVURi04JykKICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgdHJ5OgogICAgICAgICAgICBsb2NhbGUuc2V0bG9jYWxlKGxvY2FsZS5MQ19BTEwsICdFbmdsaXNoX1VuaXRlZCBTdGF0ZXMuVVRGLTgnKQogICAgICAgIGV4Y2VwdCBsb2NhbGUuRXJyb3I6CiAgICAgICAgICAgIHBhc3MKCnN5cy5zdGRvdXQucmVjb25maWd1cmUoZW5jb2Rpbmc9J3V0Zi04JykKc3lzLnN0ZGVyci5yZWNvbmZpZ3VyZShlbmNvZGluZz0ndXRmLTgnKQoKY2xhc3MgUmVkaXNDYWNoZToKICAgIGRlZiBfX2luaXRfXyhzZWxmLCBob3N0PSdsb2NhbGhvc3QnLCBwb3J0PTYzNzksIGRiPTApOgogICAgICAgIHNlbGYuY2xpZW50ID0gcmVkaXMuUmVkaXMoaG9zdD1ob3N0LCBwb3J0PXBvcnQsIGRiPWRiKQoKICAgIGRlZiBzZXQoc2VsZiwga2V5LCB2YWx1ZSwgZXg9Tm9uZSk6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LnNldChrZXksIHZhbHVlLCBleD1leCkKCiAgICBkZWYgZ2V0KHNlbGYsIGtleSk6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LmdldChrZXkpCgogICAgZGVmIGRlbGV0ZShzZWxmLCBrZXkpOgogICAgICAgIHJldHVybiBzZWxmLmNsaWVudC5kZWxldGUoa2V5KQoKICAgIGRlZiBleGlzdHMoc2VsZiwga2V5KToKICAgICAgICByZXR1cm4gc2VsZi5jbGllbnQuZXhpc3RzKGtleSkKCiAgICBkZWYgZmx1c2goc2VsZik6CiAgICAgICAgcmV0dXJuIHNlbGYuY2xpZW50LmZsdXNoZGIoKQoKdXVpZF92YWx1ZSA9ICd7dXVpZH0nCgpjbGFzcyBOb2RlQ2FjaGVIZWxwZXI6CiAgICBkZWYgX19pbml0X18oc2VsZiwgcmVkaXNfY2FjaGUsIHV1aWQpOgogICAgICAgIHNlbGYucmVkaXNfY2FjaGUgPSByZWRpc19jYWNoZQogICAgICAgIHNlbGYudXVpZCA9IHV1aWQKCiAgICBkZWYgZGVidWcoc2VsZiwgdmFsdWUpOgogICAgICAgIGtleSA9IGYidGFza19kZWJ1Zzp7c2VsZi51dWlkfSIKICAgICAgICB0cnk6CiAgICAgICAgICAgIGlmIGlzaW5zdGFuY2UodmFsdWUsIHN0cik6CiAgICAgICAgICAgICAgICBzdHJfdmFsdWUgPSB2YWx1ZQogICAgICAgICAgICBlbHNlOgogICAgICAgICAgICAgICAgc3RyX3ZhbHVlID0ganNvbi5kdW1wcyh2YWx1ZSwgZW5zdXJlX2FzY2lpPUZhbHNlKQogICAgICAgIGV4Y2VwdCBFeGNlcHRpb246CiAgICAgICAgICAgIHN0cl92YWx1ZSA9IHN0cih2YWx1ZSkKICAgICAgICBvbGRfdmFsdWUgPSBzZWxmLnJlZGlzX2NhY2hlLmdldChrZXkpCiAgICAgICAgaWYgb2xkX3ZhbHVlIGlzIG5vdCBOb25lOgogICAgICAgICAgICB0cnk6CiAgICAgICAgICAgICAgICBvbGRfdmFsdWUgPSBvbGRfdmFsdWUuZGVjb2RlKCd1dGYtOCcpCiAgICAgICAgICAgIGV4Y2VwdCBFeGNlcHRpb246CiAgICAgICAgICAgICAgICBvbGRfdmFsdWUgPSBzdHIob2xkX3ZhbHVlKQogICAgICAgICAgICBuZXdfdmFsdWUgPSBvbGRfdmFsdWUgKyAiXG4iICsgc3RyX3ZhbHVlCiAgICAgICAgZWxzZToKICAgICAgICAgICAgbmV3X3ZhbHVlID0gc3RyX3ZhbHVlCiAgICAgICAgc2VsZi5yZWRpc19jYWNoZS5zZXQoa2V5LCBuZXdfdmFsdWUpCgogICAgZGVmIG91dHB1dChzZWxmLCB2YWx1ZSk6CiAgICAgICAga2V5ID0gZiJ0YXNrX3Jlc3VsdDp7c2VsZi51dWlkfSIKICAgICAgICBpZiBpc2luc3RhbmNlKHZhbHVlLCBkaWN0KToKICAgICAgICAgICAgdHJ5OgogICAgICAgICAgICAgICAgdmFsdWUgPSBqc29uLmR1bXBzKHZhbHVlLCBlbnN1cmVfYXNjaWk9RmFsc2UpCiAgICAgICAgICAgIGV4Y2VwdCBFeGNlcHRpb246CiAgICAgICAgICAgICAgICB2YWx1ZSA9IHN0cih2YWx1ZSkKICAgICAgICBzZWxmLnJlZGlzX2NhY2hlLnNldChrZXksIHZhbHVlKQoKICAgIGRlZiBmaW5pc2goc2VsZik6CiAgICAgICAga2V5ID0gZiJ0YXNrX3N0YXR1czp7c2VsZi51dWlkfSIKICAgICAgICBzZWxmLnJlZGlzX2NhY2hlLnNldChrZXksICJmaW5pc2giKQoKICAgIGRlZiBlcnJvcihzZWxmKToKICAgICAgICBrZXkgPSBmInRhc2tfc3RhdHVzOntzZWxmLnV1aWR9IgogICAgICAgIHNlbGYucmVkaXNfY2FjaGUuc2V0KGtleSwgImVycm9yIikKCiAgICBkZWYgYmcoc2VsZiwgdmFsdWUpOgogICAgICAgIGtleSA9IGYidGFza19iZzp7c2VsZi51dWlkfSIKICAgICAgICBzZWxmLnJlZGlzX2NhY2hlLnNldChrZXksIGludCh2YWx1ZSkpCgogICAgZGVmIGlzX3N0b3Aoc2VsZik6CiAgICAgICAga2V5ID0gZiJ0YXNrX3N0b3A6e3NlbGYudXVpZH0iCiAgICAgICAgc3RvcCA9IHNlbGYucmVkaXNfY2FjaGUuZ2V0KGtleSkKICAgICAgICBpZiBzdG9wIGlzIG5vdCBOb25lIGFuZCBzdG9wID09ICcxJzoKICAgICAgICAgICAgcmV0dXJuIFRydWUKICAgICAgICByZXR1cm4gRmFsc2UKICAgIAogICAgZGVmIHNhdmVfcGlkKHNlbGYsIHBpZD1Ob25lKToKICAgICAgICBpbXBvcnQgb3MKICAgICAgICBrZXkgPSBmInRhc2tfcGlkOntzZWxmLnV1aWR9IgogICAgICAgIGlmIHBpZCBpcyBOb25lOgogICAgICAgICAgICBwaWQgPSBvcy5nZXRwaWQoKQogICAgICAgIG9sZF92YWx1ZSA9IHNlbGYucmVkaXNfY2FjaGUuZ2V0KGtleSkKICAgICAgICBpZiBvbGRfdmFsdWUgaXMgbm90IE5vbmU6CiAgICAgICAgICAgIHRyeToKICAgICAgICAgICAgICAgIG9sZF92YWx1ZSA9IG9sZF92YWx1ZS5kZWNvZGUoJ3V0Zi04JykKICAgICAgICAgICAgZXhjZXB0IEV4Y2VwdGlvbjoKICAgICAgICAgICAgICAgIG9sZF92YWx1ZSA9IHN0cihvbGRfdmFsdWUpCiAgICAgICAgICAgIG5ld192YWx1ZSA9IGYie29sZF92YWx1ZX0se3BpZH0iCiAgICAgICAgZWxzZToKICAgICAgICAgICAgbmV3X3ZhbHVlID0gc3RyKHBpZCkKICAgICAgICBzZWxmLnJlZGlzX2NhY2hlLnNldChrZXksIG5ld192YWx1ZSkKCnNwZWMgPSBpbXBvcnRsaWIudXRpbC5zcGVjX2Zyb21fZmlsZV9sb2NhdGlvbigibWFpbiIsICJ7bWFpblBhdGh9IikKbWFpbiA9IGltcG9ydGxpYi51dGlsLm1vZHVsZV9mcm9tX3NwZWMoc3BlYykKc3BlYy5sb2FkZXIuZXhlY19tb2R1bGUobWFpbikKCmNhY2hlID0gUmVkaXNDYWNoZSgne2hvc3R9Jywge3BvcnR9LCB7ZGJ9KQpub2RlX2NhY2hlX2hlbHBlciA9IE5vZGVDYWNoZUhlbHBlcihjYWNoZSwgdXVpZF92YWx1ZSkKbm9kZV9jYWNoZV9oZWxwZXIuc2F2ZV9waWQoKQoKbm9kZSA9IG1haW4uTWFpbk5vZGUoY2FjaGU9Y2FjaGUsIHV1aWQ9dXVpZF92YWx1ZSwgc2RrPW5vZGVfY2FjaGVfaGVscGVyKQoKaW5wdXRfZGF0YSA9IGpzb24ubG9hZHMoJ3tpbnB1dF9kYXRhfScpCmNvbmZpZ19kYXRhID0ganNvbi5sb2Fkcygne2NvbmZpZ19kYXRhfScpCmlmIGhhc2F0dHIobm9kZSwgJ2dldF91c2VyX2lucHV0Jyk6CiAgICBub2RlLmdldF91c2VyX2lucHV0KGNvbmZpZ19kYXRhKQppZiBoYXNhdHRyKG5vZGUsICdnZXRfbm9kZV9pbnB1dCcpOgogICAgbm9kZS5nZXRfbm9kZV9pbnB1dChpbnB1dF9kYXRhKQpub2RlLmV4ZWN1dGUoKQ=='
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