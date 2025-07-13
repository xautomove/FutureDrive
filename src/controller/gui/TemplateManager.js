import fs from 'fs';
import path from 'path';
import { log, LOG_TYPES } from '../../assets/js/utils';
import fileController from './FileController';

class TemplateManager {
    constructor() {
        // 移除路径初始化
    }

    // 获取模板目录路径
    getTemplateDir() {
        if (!window.currentProject?.path) {
            throw new Error('没有打开的项目');
        }
        const templateDir = path.join(window.currentProject.path, 'templates');
        // 确保目录存在
        if (!fs.existsSync(templateDir)) {
            fs.mkdirSync(templateDir, { recursive: true });
        }
        return templateDir;
    }

    // 保存模板
    async saveTemplate(name, templateData) {
        try {
            const templateDir = this.getTemplateDir();

            // 生成模板文件名
            const fileName = `${name}.json`;

            // 使用FileController保存模板文件
            const filePath = path.join(templateDir, fileName);
            await fileController.writeFile(filePath, JSON.stringify(templateData, null, 2));
            
            log(`模板已保存: ${fileName}`, LOG_TYPES.SUCCESS);
            return fileName;
        } catch (error) {
            log(`保存模板失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    // 获取所有模板列表
    getTemplateList() {
        try {
            const templateDir = this.getTemplateDir();
            const files = fs.readdirSync(templateDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    const content = JSON.parse(fs.readFileSync(path.join(templateDir, file), 'utf8'));
                    return {
                        name: content.name,
                        description: content.description,
                        version: content.version,
                        created: content.created,
                        fileName: file,
                        nodeCount: content.nodes.length // 添加节点数量信息
                    };
                });
        } catch (error) {
            log(`获取模板列表失败: ${error.message}`, LOG_TYPES.ERROR);
            return [];
        }
    }

    // 加载模板
    async loadTemplate(fileName) {
        try {
            const templateDir = this.getTemplateDir();
            const filePath = path.join(templateDir, fileName);
            const content = await fs.promises.readFile(filePath, 'utf8');
            const templateData = JSON.parse(content);
            
            // 验证节点路径是否存在
            const validNodes = templateData.nodes.filter(node => {
                const nodePath = node.path;
                if (!nodePath) {
                    log(`警告: 节点 ${node.id} 缺少路径信息`, LOG_TYPES.WARNING);
                    return false;
                }
                return true;
            });

            if (validNodes.length !== templateData.nodes.length) {
                log(`警告: 部分节点路径无效，已过滤`, LOG_TYPES.WARNING);
                templateData.nodes = validNodes;
            }

            // 确保节点位置信息完整
            templateData.nodes = templateData.nodes.map(node => {
                // 如果位置信息不完整，使用默认位置
                if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
                    log(`警告: 节点 ${node.id} 位置信息不完整，使用默认位置`, LOG_TYPES.WARNING);
                    return {
                        ...node,
                        position: { x: 100, y: 100 }  // 默认位置
                    };
                }
                return node;
            });
            
            log(`模板已加载: ${fileName}`, LOG_TYPES.SUCCESS);
            return templateData;
        } catch (error) {
            log(`加载模板失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

    // 删除模板
    async deleteTemplate(fileName) {
        try {
            const templateDir = this.getTemplateDir();
            const filePath = path.join(templateDir, fileName);
            await fs.promises.unlink(filePath);
            
            log(`模板已删除: ${fileName}`, LOG_TYPES.SUCCESS);
            return true;
        } catch (error) {
            log(`删除模板失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }
}

export default new TemplateManager(); 