const path = require('path');
const fs = require('fs');

class ProjectController {
  // 选择目录
  handleSelectDirectory() {
    // 这里可以用 Electron 的 dialog 或直接返回空，前端可用 window.require('electron').remote.dialog
    return null;
  }

  // 创建项目
  handleCreateProject({ name, description, path: projectPath }) {
    try {
      const projectDir = path.join(projectPath, name);
      if (fs.existsSync(projectDir)) {
        return {
          success: false,
          error: '项目目录已存在'
        };
      }
      fs.mkdirSync(projectDir, { recursive: true });
      const projectConfig = {
        name,
        description,
        path: projectDir,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      };
      const configPath = path.join(projectDir, `${name}.proj`);
      fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));
      return {
        success: true,
        projectPath: projectDir
      };
    } catch (error) {
      console.error('创建项目失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  readDirRecursive(dir) {
    const items = fs.readdirSync(dir);
    return items.map(item => {
      const fullPath = path.join(dir, item);
      const isDir = fs.statSync(fullPath).isDirectory();
      return isDir
        ? { title: item, key: fullPath, children: this.readDirRecursive(fullPath) }
        : { title: item, key: fullPath };
    });
  }

  // 打开项目
  openProject(projectPath) {
    try {
      // 检查项目路径是否存在
      if (!fs.existsSync(projectPath)) {
        return { 
          success: false, 
          error: '项目路径不存在' 
        };
      }

      // 检查是否是项目根目录
      const projectName = path.basename(projectPath);
      const projFile = path.join(projectPath, `${projectName}.proj`);
      
      if (!fs.existsSync(projFile)) {
        return { 
          success: false, 
          error: '无效的项目目录：找不到项目配置文件' 
        };
      }

      // 读取项目配置
      const projContent = fs.readFileSync(projFile, 'utf8');
      const projectConfig = JSON.parse(projContent);

      // 验证项目配置
      if (!projectConfig.path || !fs.existsSync(projectConfig.path)) {
        return { 
          success: false, 
          error: '项目配置无效：项目路径不存在' 
        };
      }

      // 读取项目目录结构
      const tree = this.readDirRecursive(projectPath);
      return { 
        success: true, 
        tree,
        config: projectConfig
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 新增：选择proj文件并自动调用openProject
  async selectAndOpenProject(onOpenProject, log, LOG_TYPES) {
    const { dialog } = window.require('@electron/remote');
    const fs = window.require('fs');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '项目文件', extensions: ['proj'] }
      ]
    });
    if (!result.canceled && result.filePaths && result.filePaths[0]) {
      try {
        const projContent = fs.readFileSync(result.filePaths[0], 'utf8');
        const projectConfig = JSON.parse(projContent);
        if (!fs.existsSync(projectConfig.path)) {
          log && log(`项目路径不存在: ${projectConfig.path}`, LOG_TYPES && LOG_TYPES.ERROR);
          return;
        }
        onOpenProject(projectConfig.path, projectConfig);
      } catch (error) {
        log && log(`打开项目失败: ${error.message}`, LOG_TYPES && LOG_TYPES.ERROR);
      }
    }
  }
}

module.exports = new ProjectController();