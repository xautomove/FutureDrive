import path from 'path';
import fs from 'fs';
import GLOBALS from '../../assets/js/globals';
import { log, LOG_TYPES } from '../../assets/js/utils';
import commandExecutor from '../../assets/js/commandExecutor';

class PythonNodeExecutor {
    constructor() {
        this.tempDir = path.join(GLOBALS.USERDATA_DIR, 'temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async execute(node, inputData, configData) {
        try {
            // 构建节点路径
            const nodePath = path.join(GLOBALS.USERDATA_DIR, 'node', node.path);
            const mainPath = path.join(nodePath, 'main.py');
            const configPath = path.join(nodePath, 'config.json');

            // 读取 config.json，补全输入
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

            // 创建Python包装脚本
            const scriptContent = `
import sys
import json
import importlib.util
import os
import locale

# 设置环境变量和编码
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.platform == 'win32':
    try:
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except locale.Error:
        try:
            locale.setlocale(locale.LC_ALL, 'English_United States.UTF-8')
        except locale.Error:
            pass

# 设置标准输出和错误输出的编码
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 导入主程序
spec = importlib.util.spec_from_file_location("main", "${mainPath.replace(/\\/g, '\\\\')}")
main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)

# 创建节点实例
node = main.MainNode()

# 设置输入数据
input_data = ${JSON.stringify(realInputData)}
node.get_node_input(input_data)

# 设置配置数据
config_data = ${JSON.stringify(configData)}
node.get_user_input(config_data)

# 执行节点
result = node.execute()

# 输出结果
print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
`;

            // 创建临时脚本文件
            const tempScriptPath = commandExecutor.createTempFile(scriptContent, '.py');

            try {
                // 使用commandExecutor执行Python脚本
                const { stderr } = await commandExecutor.execute('python3', ['-u', tempScriptPath], {
                    nodeId: node.id,
                    env: {
                        PYTHONIOENCODING: 'utf-8',
                        LANG: 'en_US.UTF-8',
                        LC_ALL: 'en_US.UTF-8'
                    },
                    onStdout: (text) => log(`Python stdout: ${text}`, LOG_TYPES.INFO),
                    onStderr: (text) => log(`Python stderr: ${text}`, LOG_TYPES.INFO),
                    onError: (error) => {
                        if (error.message.includes('ENOENT')) {
                            throw new Error('Python 未安装或未添加到系统环境变量中。请安装 Python 并确保将其添加到系统环境变量。');
                        }
                        throw error;
                    }
                });

                // 解析结果
                const resultMatch = stderr.match(/\{[\s\S]*\}/);
                if (resultMatch) {
                    return JSON.parse(resultMatch[0]);
                } else {
                    throw new Error('无法解析 Python 输出结果');
                }
            } finally {
                // 清理临时文件
                commandExecutor.deleteTempFile(tempScriptPath);
            }

        } catch (error) {
            log(`执行节点失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    // 强制终止当前 Python 进程
    killActiveProcess() {
        console.log('killActiveProcess2');
        commandExecutor.killActiveProcess();
    }
}

export default PythonNodeExecutor; 