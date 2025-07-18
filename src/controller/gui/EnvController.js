import { get } from '../../assets/js/http';
import config from '../../assets/js/config';
import { writeFile, readFile } from './FileController';
import path from 'path';
import os from 'os';
import fs from 'fs';
const { execSync, spawn } = window.require('child_process');
const { shell } = window.require('electron');
const { log, LOG_TYPES } = require('../../assets/js/utils');

class EnvController {
  constructor() {
    this.platform = window.systemInfo?.platform || process.platform;
    this.isWindows = window.systemInfo?.isWindows || this.platform === 'win32';
    this.isUbuntu = window.systemInfo?.isUbuntu || this.platform === 'linux';
  }

  /**
   * 从远程获取环境列表并检测安装状态
   * @returns {Promise<Array>} 环境列表
   */
  async getEnvironmentList() {
    try {
      var envListUrl = config.get('environment.listUrl');
      var environments = '';
      if (envListUrl) {
        environments = await get(envListUrl);
      }

      if (!environments) {
        environments = this.getLocalTestData();
      }

      if (typeof environments === 'string') {
        try {
          environments = JSON.parse(environments);
        } catch (e) {
          console.error('解析环境列表失败:', e);
          environments = this.getLocalTestData();
        }
      }

      if (!Array.isArray(environments)) {
        environments = this.getLocalTestData();
      }

      const environmentsWithStatus = await Promise.all(
        environments.map(async (env) => {
          const checkResult = await this.detectEnvByCommand(env);
          return {
            ...env,
            installed: checkResult.installed,
            version: checkResult.version || env.version
          };
        })
      );
      return environmentsWithStatus;
    } catch (error) {
      console.error('获取环境列表失败:', error);
       const data = this.getLocalTestData();
       const environmentsWithStatus = await Promise.all(
        data.map(async (env) => {
          const checkResult = await this.detectEnvByCommand(env);
          return {
            ...env,
            installed: checkResult.installed,
            version: checkResult.version || env.version
          };
        })
      );
      return environmentsWithStatus;

    }
  }

  /**
   * 根据环境配置检测安装状态
   * @param {Object} env 环境配置对象
   * @returns {Promise<{installed: boolean, version: string}>}
   */
  async detectEnvByCommand(env) {
    try {
      const isWindows = this.platform === 'win32';
      const checkCommand = isWindows ? env.checkCommand.windows : env.checkCommand.ubuntu;

      if (!checkCommand) {
        return { installed: false, version: '' };
      }

      const output = execSync(checkCommand, { encoding: 'utf-8' });

      if (env.name === 'NVIDIA Driver') {
        const versionMatch = output.match(/Driver Version: (\d+\.\d+)/);
        if (versionMatch) {
          return { installed: true, version: versionMatch[1] };
        }
      } else if (env.name === 'CUDA') {
        const versionMatch = output.match(/CUDA Version: (\d+\.\d+)/);
        if (versionMatch) {
          return { installed: true, version: versionMatch[1] };
        }
        const nvccMatch = output.match(/release (\d+\.\d+)/);
        if (nvccMatch) {
          return { installed: true, version: nvccMatch[1] };
        }
      }

      return { installed: true };
    } catch (e) {
      return { installed: false, version: '' };
    }
  }

  async installEnv(env, installUrl) {
    try {
      if(env.name === "NVIDIA Driver"){
        const url = this.isWindows ? env.installUrl.windows : env.installUrl.ubuntu;
        await shell.openExternal(url);
        return;
      }
      let pythonScript;

      if(installUrl.startsWith("http")){
        pythonScript = await get(installUrl);
      }else{
        pythonScript = await readFile(installUrl);
        if(!pythonScript.success){
          return { success: false, message: '读取文件失败' };
        }
        pythonScript = pythonScript.content;
      }
      
      if (!pythonScript) {
        return { success: false, message: '下载失败' };
      }

      const tempDir = path.join(os.tmpdir(), 'futuredrive_install');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const pythonScriptPath = path.join(tempDir, `install_${env.name.toLowerCase()}.py`);

      await writeFile(pythonScriptPath, pythonScript,true);
      if (!fs.existsSync(pythonScriptPath)) {
        return { success: false, message: `脚本写出失败: ${pythonScriptPath} 未找到` };
      }

      let scriptContent;
      if (this.isWindows) {
        scriptContent = `@echo off
echo 开始安装 ${env.name} ${env.version}...
python "${pythonScriptPath}"
echo 安装完成！
pause`;
      } else {
        scriptContent = `#!/bin/bash
echo "开始安装 ${env.name} ${env.version}..."
sudo python3 "${pythonScriptPath}"
echo "安装完成！"
pause`;
      }

      const scriptExt = this.isWindows ? '.bat' : '.sh';
      const scriptPath = path.join(tempDir, `install_${env.name.toLowerCase()}${scriptExt}`);
      const result = await writeFile(scriptPath, scriptContent);
      if (!result) {
        return { success: false, message: '写入失败' };
      }

      if (this.isUbuntu) {
        const { exec } = require('child_process');
        exec(`pkexec chmod +x ${scriptPath}`, (error, stdout, stderr) => {
          if (error) {
            console.error(`执行权限设置失败: ${error}`);
            return;
          }
          let command, args;
          if (this.isWindows) {
            command = 'cmd.exe';
            args = ['/k', scriptPath];
          } else {
            command = 'gnome-terminal';
            args = ['--', 'bash', '-c', `${scriptPath}; exec bash`];
          }

          const terminal = spawn(command, args, {
            detached: true,
            stdio: 'ignore'
          });

          terminal.unref();
        });
      }
    } catch (error) {
      log(`安装环境失败: ${error.message}`, LOG_TYPES.ERROR);
    }
  }

  /**
  * 获取本地测试环境数据
  * @returns {Array} 环境列表
  */
  getLocalTestData() {
    const testData = `[
      {
        "name": "ROS2",
        "version": "humble",
        "description": "机器人操作系统2代",
        "installUrl": {
          "windows": "xxx",
          "ubuntu": "http://180.76.236.15:8777/install_ros2_humble.py"
        },
        "checkCommand": {
          "windows": "ros2",
          "ubuntu": "ros2 -h"
        },
        "installed": false
      },
      {
        "name": "Python3",
        "version": "3.10",
        "description": "Python编程语言",
        "installUrl": {
          "windows": "https://www.python.org/downloads/windows/",
          "ubuntu": "http://180.76.236.15:8777/install_py.py"
        },
        "checkCommand": {
          "windows": "python3 --version",
          "ubuntu": "python3 --version"
        },
        "installed": false
      },
      {
        "name": "CUDA",
        "version": "未知",
        "description": "NVIDIA CUDA并行计算平台",
        "installUrl": {
          "windows": "http://180.76.236.15:8777/install_cuda.py",
          "ubuntu": "http://180.76.236.15:8777/install_cuda.py"
        },
        "checkCommand": {
          "windows": "nvcc --version",
          "ubuntu": "/usr/local/cuda/bin/nvcc --version"
        },
        "installed": false
      },
      {
        "name": "cuDNN",
        "version": "9.6.0",
        "description": "NVIDIA CUDA深度神经网络库",
        "installUrl": {
          "windows": "http://180.76.236.15:8777/install_cudnn.py",
          "ubuntu": "http://180.76.236.15:8777/install_cudnn.py"
        },
        "checkCommand": {
          "windows": "findstr CUDNN_MAJOR \\"%CUDA_PATH%\\\\include\\\\cudnn_version.h\\"",
          "ubuntu": "cat /usr/include/cudnn_version.h | grep CUDNN_MAJOR -A 2"
        },
        "installed": false
      },
      {
        "name": "TensorRT",
        "version": "10.7.0",
        "description": "NVIDIA高性能深度学习推理库",
        "installUrl": {
          "windows": "http://180.76.236.15:8777/install_tensorrt.py",
          "ubuntu": "http://180.76.236.15:8777/install_tensorrt.py"
        },
        "checkCommand": {
          "windows": "dpkg -l | findstr tensorrt",
          "ubuntu": "python3 -c \\"import tensorrt as trt; print('TensorRT version: ' + str(trt.__version__))\\""
        },
        "installed": false
      },
      {
        "name": "NVIDIA Driver",
        "version": "未知",
        "description": "NVIDIA显卡驱动",
        "installUrl": {
          "windows": "https://www.nvidia.cn/geforce/drivers/",
          "ubuntu": "https://www.nvidia.cn/geforce/drivers/"
        },
        "checkCommand": {
          "windows": "nvidia-smi",
          "ubuntu": "nvidia-smi"
        },
        "installed": false
      }
    ]`;

    try {
      return JSON.parse(testData);
    } catch (e) {
      return [];
    }
  }
}

export default new EnvController();