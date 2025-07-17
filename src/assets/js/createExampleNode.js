const fs = require('fs');
const path = require('path');
import GLOBALS from './globals';
import config from './config';

async function createExampleNode() {
    
    const isWrite = config.get('exampleNodeCreated');
    console.log(isWrite);
    if (isWrite){
        console.log('示例节点已存在');
        return;
    };

    const calcNodeDir = path.join(GLOBALS.USERDATA_DIR, 'node', 'calc_node');
    if (!fs.existsSync(calcNodeDir)) {
        fs.mkdirSync(calcNodeDir, { recursive: true });
    }

    const calcConfig = {
        "name": "数学计算节点",
        "description": "一个简单的数学计算节点，可以进行加减乘除运算",
        "type": "流",
        "parameters": {
            "inputs": [
                {
                    "input_type": "user/node",
                    "type": "number",
                    "name": "数值1",
                    "default_value": 0
                },
                {
                    "input_type": "user/node",
                    "type": "number",
                    "name": "数值2",
                    "default_value": 0
                }
            ],
            "outputs": [
                {
                    "type": "number",
                    "name": "加法结果"
                },
                {
                    "type": "number",
                    "name": "减法结果"
                },
                {
                    "type": "number",
                    "name": "乘法结果"
                },
                {
                    "type": "number",
                    "name": "除法结果"
                }
            ]
        },
        "config": [
            {
                "name": "运算类型",
                "default_value": "all",
                "type": "select",
                "options": [
                    {"label": "全部运算", "value": "all"},
                    {"label": "只做加法", "value": "add"},
                    {"label": "只做减法", "value": "subtract"},
                    {"label": "只做乘法", "value": "multiply"},
                    {"label": "只做除法", "value": "divide"}
                ]
            }
        ]
    };

    fs.writeFileSync(
        path.join(calcNodeDir, 'config.json'),
        JSON.stringify(calcConfig, null, 2)
    );

    const calcMainPy = `import sys

class MainNode:
    def __init__(self):
        self.input_data = {}
        self.output_data = {}
        self.config = {}

    def get_node_input(self, config):
        self.input_data = config

    def get_user_input(self, config):
        self.config = {item['name']: item['default_value'] for item in config}

    def execute(self):
        # 获取输入值
        num1 = float(self.input_data.get('数值1', 0))
        num2 = float(self.input_data.get('数值2', 0))
        # 从配置中获取运算类型
        operation = self.config.get('运算类型', 'all')
        
        # 初始化结果
        result = {
            "outputs": {
                "加法结果": None,
                "减法结果": None,
                "乘法结果": None,
                "除法结果": None
            }
        }
        
        # 根据运算类型执行计算
        if operation in ['all', 'add']:
            result["outputs"]["加法结果"] = num1 + num2
            
        if operation in ['all', 'subtract']:
            result["outputs"]["减法结果"] = num1 - num2
            
        if operation in ['all', 'multiply']:
            result["outputs"]["乘法结果"] = num1 * num2
            
        if operation in ['all', 'divide']:
            if num2 != 0:
                result["outputs"]["除法结果"] = num1 / num2
        
        return result
`;

    fs.writeFileSync(
        path.join(calcNodeDir, 'main.py'),
        calcMainPy
    );

    // 创建初始值节点
    const initNodeDir = path.join(GLOBALS.USERDATA_DIR, 'node', 'init_node');
    if (!fs.existsSync(initNodeDir)) {
        fs.mkdirSync(initNodeDir, { recursive: true });
    }

    // 初始值节点的 config.json
    const initConfig = {
        "name": "初始值节点",
        "description": "一个提供初始数值的节点，没有输入，只有输出",
        "type": "流",
        "parameters": {
            "inputs": [],
            "outputs": [
                {
                    "type": "number",
                    "name": "数值"
                }
            ]
        },
        "config": [
            {
                "name": "初始值",
                "default_value": "0",
                "type": "number",
                "description": "设置要输出的数值"
            }
        ]
    };

    fs.writeFileSync(
        path.join(initNodeDir, 'config.json'),
        JSON.stringify(initConfig, null, 2)
    );

    // 初始值节点的 main.py
    const initMainPy = `import sys

class MainNode:
    def __init__(self):
        self.input_data = {}
        self.output_data = {}
        self.config = {}

    def get_node_input(self, config):
        # 初始值节点没有输入
        pass

    def get_user_input(self, config):
        self.config = {item['name']: item['default_value'] for item in config}

    def execute(self):
        # 获取配置的初始值
        value = float(self.config.get('初始值', 0))
        
        # 返回结果
        result = {
            "outputs": {
                "数值": value
            }
        }
        
        return result
`;

    fs.writeFileSync(
        path.join(initNodeDir, 'main.py'),
        initMainPy
    );

    // 创建任务演示节点
    const taskNodeDir = path.join(GLOBALS.USERDATA_DIR, 'node', 'task_node');
    if (!fs.existsSync(taskNodeDir)) {
        fs.mkdirSync(taskNodeDir, { recursive: true });
    }

    // 任务演示节点的 config.json
    const taskConfig = {
        "name": "任务演示节点",
        "description": "一个无输入无输出的任务节点，定时五秒打印当前时间",
        "type": "任务",
        "parameters": {
            "inputs": [],
            "outputs": []
        },
        "config": []
    };

    fs.writeFileSync(
        path.join(taskNodeDir, 'config.json'),
        JSON.stringify(taskConfig, null, 2)
    );

    // 任务演示节点的 main.py
    const taskMainPy = `import sys
import time
import datetime

class MainNode:
    def __init__(self):
        self.input_data = {}
        self.output_data = {}
        self.config = {}

    def get_node_input(self, config):
        # 任务节点没有输入
        pass

    def get_user_input(self, config):
        # 任务节点没有配置
        pass

    def execute(self):
        # 定时五秒打印当前时间
        while True:
            current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"当前时间: {current_time}")
            time.sleep(3)
        
        return {"outputs": {}}
`;

    fs.writeFileSync(
        path.join(taskNodeDir, 'main.py'),
        taskMainPy
    );

    // 标记已写入示例节点
    await config.set('exampleNodeCreated', true);

    console.log('示例节点创建完成:', calcNodeDir, initNodeDir, taskNodeDir);
}

export default createExampleNode; 