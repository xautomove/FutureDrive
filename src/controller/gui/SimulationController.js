 
import config from '../../assets/js/config';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { download } from '../../assets/js/http';
import os from 'os';

const simulationList = [
  {
    name: 'Carla',
    version: '0.10.0',
    description: '高保真自动驾驶仿真平台',
    detectCommand: 'which CarlaUnreal.sh',
    installScript: 'https://carla-releases.b-cdn.net/Linux/Carla-0.10.0-Linux-Shipping.tar.gz',
    dualLaunch: true,
    installCheckPath: '/opt/carla/CarlaUnreal.sh', 
  },
  {
    name: 'Gazebo',
    version: '11',
    description: '经典机器人仿真平台',
    detectCommand: 'which gazebo',
    installScript: 'https://future.automoves.cn/install_script/install_gazebo.py',
    dualLaunch: false,
    installCheckPath: '/usr/bin/gazebo',
  },
];

const SimulationController = {
  getSimulationList: async () => {
    return simulationList;
  },

  checkSimulationInstalled: async (name) => {
    const simConfig = (await config.get('simulation')) || {};
    let platformConfig = simConfig[name] || {};
    if (platformConfig.installed) {
      return true;
    }
    const sim = simulationList.find(s => s.name === name);
    if (sim && sim.installCheckPath && fs.existsSync(sim.installCheckPath)) {
      platformConfig.installed = true;
      simConfig[name] = platformConfig;
      simConfig[name].launchPath = sim.installCheckPath;
      await config.set('simulation', simConfig);
      return true;
    }
    return false;
  },

  setManualInstall: async (name, launchPath) => {
    let simConfig = (await config.get('simulation')) || {};
    simConfig[name] = simConfig[name] || {};
    simConfig[name].installed = true;
    simConfig[name].launchPath = launchPath;
    await config.set('simulation', simConfig);
    return true;
  },

  installSimulation: async (name, { downloadPath, onProgress } = {}) => {
    const sim = simulationList.find(s => s.name === name);
    if (!sim) throw new Error('未知仿真平台');
    const url = sim.installScript;
    const ext = url.split('.').pop().toLowerCase();
    let finalLaunchPath = '';
    let finalDir = '';
    const isLocalScript = url.startsWith('/') || url.startsWith('file://');
    try {
      if (['py', 'sh'].includes(ext)) {
        let scriptPath;
        if (isLocalScript) {
          scriptPath = url;
        } else {
          if (!downloadPath) throw new Error('未指定下载路径');
          const fileName = url.split('/').pop();
          scriptPath = path.join(downloadPath, fileName);
          await download(url, scriptPath, (progress) => {
            if (onProgress) onProgress(progress);
          });
        }
        let pythonPath = 'python3';
        try {
          const nodeConfig = (await config.get('node')) || {};
          if (nodeConfig.pythonPath) pythonPath = nodeConfig.pythonPath;
        } catch (e) {
          console.log('获取Python路径配置失败，使用默认值:', e.message);
        }
        
        const tempDir = path.join(os.tmpdir(), 'futuredrive_sim_install');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const shellScriptPath = path.join(tempDir, `install_${name.toLowerCase()}.sh`);
        const shellContent = `#!/bin/bash
echo \"开始安装 ${name}...\"
# 检测并退出 Conda 环境
if [ ! -z "$CONDA_DEFAULT_ENV" ]; then
  echo \"检测到 Conda 环境: $CONDA_DEFAULT_ENV，正在退出...\"
  conda deactivate 2>/dev/null || true
  while [ ! -z "$CONDA_DEFAULT_ENV" ]; do
    conda deactivate 2>/dev/null || break
  done
  echo \"已退出 Conda 环境\"
  # 手动清理 PATH 中的 miniconda 路径
  export PATH=$(echo $PATH | tr ':' '\n' | grep -v 'miniconda3' | grep -v 'anaconda3' | tr '\n' ':' | sed 's/:$//')
  echo \"已清理 PATH 中的 Conda 路径\"
  # 清理 Conda 相关环境变量
  unset CONDA_DEFAULT_ENV
  unset CONDA_PREFIX
  unset CONDA_PREFIX_1
  unset CONDA_PROMPT_MODIFIER
  unset CONDA_PYTHON_EXE
  unset CONDA_SHLVL
  unset PYTHONPATH
  echo \"已清理 Conda 环境变量\"
fi
# 加载 ROS 环境
if [ -f "/opt/ros/humble/setup.bash" ]; then
  source /opt/ros/humble/setup.bash
  echo \"已加载 ROS Humble 环境\"
fi
${ext === 'py' ? `\"${pythonPath}\" \"${scriptPath}\"` : `bash \"${scriptPath}\"`}
echo \"安装完成！\"
read -p \"按任意键退出...\"`;
        fs.writeFileSync(shellScriptPath, shellContent, 'utf8');
        fs.chmodSync(shellScriptPath, 0o755);
        const { spawn } = require('child_process');
        spawn('gnome-terminal', ['--', 'bash', '-c', `${shellScriptPath}; exec bash`], {
          detached: true,
          stdio: 'ignore'
        }).unref();
        return { started: true };
      }
      if (['tar', 'gz', 'zip'].includes(ext)) {
        let extractDir = savePath.replace(/\.(tar\.gz|zip|tar|gz)$/i, '');
        if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir);
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          const command = `mkdir -p "${extractDir}" && tar -xzf "${savePath}" -C "${extractDir}" --strip-components=1`;
          exec(command, (error) => {
            if (error) reject(error); else resolve();
          });
        });
        const files = fs.readdirSync(extractDir);
        const shFile = files.find(f => f.endsWith('.sh'));
        if (!shFile) throw new Error('未找到启动脚本(.sh)');
        finalLaunchPath = path.join(extractDir, shFile);
        finalDir = extractDir;
        let simConfig = (await config.get('simulation')) || {};
        simConfig[name] = simConfig[name] || {};
        simConfig[name].installed = true;
        simConfig[name].launchPath = finalLaunchPath;
        simConfig[name].installDir = finalDir;
        await config.set('simulation', simConfig);
        return { launchPath: finalLaunchPath, installDir: finalDir };
      } else {
        throw new Error('不支持的安装包类型');
      }
    } catch (error) {
      throw error;
    }
  },

  getSimulationConfig: async (name) => {
    const simConfig = (await config.get('simulation')) || {};
    return simConfig[name] || {};
  },

  setSimulationConfig: async (name, cfg) => {
    let simConfig = (await config.get('simulation')) || {};
    simConfig[name] = { ...simConfig[name], ...cfg };
    await config.set('simulation', simConfig);
    return true;
  },

  startSimulation: async (name) => {
    try {
      const platformConfig = await SimulationController.getSimulationConfig(name);
      if (name === 'Gazebo') {
        const { launchFile, launchArgs = '' } = platformConfig;
        const { spawn, execSync } = require('child_process');

        try {
          execSync('pkill -9 gzserver', { stdio: 'ignore' });
        } catch (e) {
        }
        if (launchFile) {
          const ext = launchFile.split('.').pop().toLowerCase();
          
          let pythonPath = 'python3';
          try {
            const nodeConfig = (await config.get('node')) || {};
            if (nodeConfig.pythonPath) pythonPath = nodeConfig.pythonPath;
          } catch (e) {
            console.log('获取Python路径配置失败，使用默认值:', e.message);
          }

          const tempDir = path.join(os.tmpdir(), 'futuredrive_sim_launch');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          const shellScriptPath = path.join(tempDir, `launch_gazebo.sh`);
          const shellContent = `#!/bin/bash
echo \"启动 Gazebo 控制脚本...\"
# 检测并退出 Conda 环境
if [ ! -z "$CONDA_DEFAULT_ENV" ]; then
  echo \"检测到 Conda 环境: $CONDA_DEFAULT_ENV，正在退出...\"
  conda deactivate 2>/dev/null || true
  while [ ! -z "$CONDA_DEFAULT_ENV" ]; do
    conda deactivate 2>/dev/null || break
  done
  echo \"已退出 Conda 环境\"
  # 手动清理 PATH 中的 miniconda 路径
  export PATH=$(echo $PATH | tr ':' '\n' | grep -v 'miniconda3' | grep -v 'anaconda3' | tr '\n' ':' | sed 's/:$//')
  echo \"已清理 PATH 中的 Conda 路径\"
  # 清理 Conda 相关环境变量
  unset CONDA_DEFAULT_ENV
  unset CONDA_PREFIX
  unset CONDA_PREFIX_1
  unset CONDA_PROMPT_MODIFIER
  unset CONDA_PYTHON_EXE
  unset CONDA_SHLVL
  unset PYTHONPATH
  echo \"已清理 Conda 环境变量\"
fi
# 加载 ROS 环境
if [ -f "/opt/ros/humble/setup.bash" ]; then
  source /opt/ros/humble/setup.bash
  echo \"已加载 ROS Humble 环境\"
fi
${ext === 'py' ? `\"${pythonPath}\" \"${launchFile}\" ${launchArgs}` : `bash \"${launchFile}\" ${launchArgs}`}
echo \"脚本执行完成！\"
read -p \"按任意键退出...\"`;
          fs.writeFileSync(shellScriptPath, shellContent, 'utf8');
          fs.chmodSync(shellScriptPath, 0o755);
          spawn('gnome-terminal', ['--', 'bash','-l', '-c', `${shellScriptPath}; exec bash`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
        } else {
          const command = `gazebo${launchArgs ? ' ' + launchArgs : ''}`;
          spawn('gnome-terminal', ['--', 'bash', '-l', '-c', `${command}; exec bash`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
          
        }
        return;
      }
      if (!platformConfig.installed || !platformConfig.launchPath) {
        throw new Error(`${name} 未安装或启动路径未配置`);
      }
      return await SimulationController._runLaunchPath(platformConfig.launchPath);
    } catch (error) {
      console.error(`启动 ${name} 失败:`, error);
      throw error;
    }
  },

  controlSimulation: async (name) => {
    try {
      const platformConfig = await SimulationController.getSimulationConfig(name);
      if (!platformConfig.launchFile) {
        throw new Error(`${name} 未配置控制脚本`);
      }
      const { host = '127.0.0.1', port = '2000', map = 'Town01', launchArgs = '' } = platformConfig;
      const filePath = platformConfig.launchFile;
      const ext = filePath.split('.').pop();
      let pythonPath = 'python3';
      try {
        const nodeConfig = (await config.get('node')) || {};
        if (nodeConfig.pythonPath) pythonPath = nodeConfig.pythonPath;
      } catch (e) {}
      let command;
      if (ext === 'py') {
        command = `gnome-terminal -- bash -c "${pythonPath} '${filePath}' --host ${host} --port ${port} --map ${map} ${launchArgs}; exec bash"`;
      } else if (ext === 'sh') {
        command = `gnome-terminal -- bash -c "bash '${filePath}' --host ${host} --port ${port} --map ${map} ${launchArgs}; exec bash"`;
      } else {
        throw new Error('仅支持 py 或 sh 脚本');
      }
      return await SimulationController._runCommand(command);
    } catch (error) {
      console.error(`控制 ${name} 失败:`, error);
      throw error;
    }
  },

  uninstallSimulation: async (name) => {
    let simConfig = (await config.get('simulation')) || {};
    simConfig[name] = {};
    await config.set('simulation', simConfig);
    return true;
  },

  _runLaunchPath: async (launchPath) => {
    return new Promise((resolve, reject) => {
      const launchDir = launchPath.substring(0, launchPath.lastIndexOf('/'));
      const command = `gnome-terminal -- bash -c "cd '${launchDir}' && bash '${launchPath}'; exec bash"`;
      exec(command, (error) => {
        if (error) {
          reject(new Error(`启动失败: ${error.message}`));
        } else {
          resolve('仿真启动成功');
        }
      });
    });
  },

  _runCommand: async (command) => {
    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(new Error(`命令执行失败: ${error.message}`));
        } else {
          resolve('命令执行成功');
        }
      });
    });
  },
};

export default SimulationController; 