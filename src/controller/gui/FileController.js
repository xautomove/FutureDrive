const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { dialog } = require('@electron/remote');
const { log, LOG_TYPES } = require('../../assets/js/utils');

class FileController {
  // 创建文件
  createFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return {
          success: false,
          error: '文件已存在'
        };
      }

      // 获取父目录路径
      const parentPath = path.dirname(filePath);
      
      // 检查父目录是否存在
      if (!fs.existsSync(parentPath)) {
        return {
          success: false,
          error: '父目录不存在'
        };
      }

      // 检查父目录是否为文件夹
      const parentStats = fs.statSync(parentPath);
      if (!parentStats.isDirectory()) {
        // 如果父路径是文件，则使用父路径的父目录
        const grandParentPath = path.dirname(parentPath);
        const newFilePath = path.join(grandParentPath, path.basename(filePath));
        
        if (fs.existsSync(newFilePath)) {
          return {
            success: false,
            error: '文件已存在'
          };
        }

        fs.writeFileSync(newFilePath, '');
        log(`创建文件成功: ${newFilePath}`, LOG_TYPES.SUCCESS);
        return {
          success: true,
          path: newFilePath
        };
      }

      // 如果父路径是文件夹，直接创建
      fs.writeFileSync(filePath, '');
      log(`创建文件成功: ${filePath}`, LOG_TYPES.SUCCESS);
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      log(`创建文件失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 创建文件夹
  createFolder(folderPath) {
    try {
      if (fs.existsSync(folderPath)) {
        return {
          success: false,
          error: '文件夹已存在'
        };
      }

      // 获取父目录路径
      const parentPath = path.dirname(folderPath);
      
      // 检查父目录是否存在
      if (!fs.existsSync(parentPath)) {
        return {
          success: false,
          error: '父目录不存在'
        };
      }

      // 检查父目录是否为文件夹
      const parentStats = fs.statSync(parentPath);
      if (!parentStats.isDirectory()) {
        // 如果父路径是文件，则使用父路径的父目录
        const grandParentPath = path.dirname(parentPath);
        const newFolderPath = path.join(grandParentPath, path.basename(folderPath));
        
        if (fs.existsSync(newFolderPath)) {
          return {
            success: false,
            error: '文件夹已存在'
          };
        }

        fs.mkdirSync(newFolderPath, { recursive: true });
        log(`创建文件夹成功: ${newFolderPath}`, LOG_TYPES.SUCCESS);
        return {
          success: true,
          path: newFolderPath
        };
      }

      // 如果父路径是文件夹，直接创建
      fs.mkdirSync(folderPath, { recursive: true });
      log(`创建文件夹成功: ${folderPath}`, LOG_TYPES.SUCCESS);
      return {
        success: true,
        path: folderPath
      };
    } catch (error) {
      log(`创建文件夹失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 递归删除文件夹
  deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
      fs.readdirSync(folderPath).forEach((file) => {
        const curPath = path.join(folderPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // 递归删除子文件夹
          this.deleteFolderRecursive(curPath);
        } else {
          // 删除文件
          fs.unlinkSync(curPath);
        }
      });
      // 删除空文件夹
      fs.rmdirSync(folderPath);
    }
  }

  //文件是否存在
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  // 删除文件或文件夹
  deleteFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: '文件或文件夹不存在'
        };
      }

      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        // 如果是文件夹，递归删除
        this.deleteFolderRecursive(filePath);
        log(`删除文件夹成功: ${filePath}`, LOG_TYPES.SUCCESS);
      } else {
        // 如果是文件，直接删除
        fs.unlinkSync(filePath);
        log(`删除文件成功: ${filePath}`, LOG_TYPES.SUCCESS);
      }

      return {
        success: true
      };
    } catch (error) {
      log(`删除失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 重命名文件
  renameFile(oldPath, newPath) {
    try {
      if (!fs.existsSync(oldPath)) {
        return {
          success: false,
          error: '文件不存在'
        };
      }
      if (fs.existsSync(newPath)) {
        return {
          success: false,
          error: '目标文件已存在'
        };
      }
      fs.renameSync(oldPath, newPath);
      log(`重命名文件成功: ${oldPath} -> ${newPath}`, LOG_TYPES.SUCCESS);
      return {
        success: true,
        path: newPath
      };
    } catch (error) {
      log(`重命名文件失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 在资源管理器中打开
  openInExplorer(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: '文件不存在'
        };
      }
      // 使用 shell 打开文件所在目录
      const directory = path.dirname(filePath);
      shell.openPath(directory);
      log(`在资源管理器中打开: ${directory}`, LOG_TYPES.SUCCESS);
      return {
        success: true
      };
    } catch (error) {
      log(`打开资源管理器失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 读取文件内容
  readFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: '文件不存在'
        };
      }

      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: '不能读取文件夹'
        };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      log(`读取文件成功: ${filePath}`, LOG_TYPES.SUCCESS);
      return {
        success: true,
        content: content
      };
    } catch (error) {
      log(`读取文件失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 写入文件内容
  writeFile(filePath, content,isdel=false) {
    try {
      // 确保父目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if(isdel && fs.existsSync(filePath)){
        fs.unlinkSync(filePath);
      }

      fs.writeFileSync(filePath, content, 'utf8');
      log(`写入文件成功: ${filePath}`, LOG_TYPES.SUCCESS);
      return {
        success: true
      };
    } catch (error) {
      log(`写入文件失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 显示保存文件对话框
  async showSaveDialog(options = {}) {
    try {
      const result = await dialog.showSaveDialog({
        ...options,
        filters: options.filters || [
          { name: 'Text Files', extensions: ['txt'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        return {
          success: true,
          filePath: result.filePath
        };
      }
      return {
        success: false,
        error: '用户取消保存'
      };
    } catch (error) {
      log(`显示保存对话框失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async selectFile(options = {}){
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: options.filters || [
        { name: 'Text Files', extensions: ['txt'] }
      ]
    });
    if (result.canceled) {
      return {
        success: false,
        error: '用户取消选择'
      };
    }
    return {
      success: true,
      filePath: result.filePaths[0]
    };
  }

  // 选择目录
  async selectDirectory(options = {}) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      ...options
    });
    if (result.canceled) {
      return {
        success: false,
        error: '用户取消选择'
      };
    }
    return {
      success: true,
      path: result.filePaths[0]
    };
  }

  // 复制文件
  copyFile(sourcePath, targetPath) {
    try {
      if (!fs.existsSync(sourcePath)) {
        return {
          success: false,
          error: '源文件不存在'
        };
      }

      // 确保目标目录存在
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 如果目标文件已存在，先删除
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }

      // 复制文件
      fs.copyFileSync(sourcePath, targetPath);
      // log(`复制文件成功: ${sourcePath} -> ${targetPath}`, LOG_TYPES.SUCCESS);
      return {
        success: true,
        path: targetPath
      };
    } catch (error) {
      log(`文件操作失败: ${error.message}`, LOG_TYPES.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new FileController(); 