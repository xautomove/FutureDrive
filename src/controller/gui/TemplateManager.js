import fs from 'fs';
import path from 'path';
import { log, LOG_TYPES } from '../../assets/js/utils';
import fileController from './FileController';

class TemplateManager {
    constructor() {
    }

    getTemplateDir() {
        if (!window.currentProject?.path) {
            throw new Error('没有打开的项目');
        }
        const templateDir = path.join(window.currentProject.path, 'templates');
        if (!fs.existsSync(templateDir)) {
            fs.mkdirSync(templateDir, { recursive: true });
        }
        return templateDir;
    }

    async saveTemplate(name, templateData) {
        try {
            const templateDir = this.getTemplateDir();

            const fileName = `${name}.json`;

            const filePath = path.join(templateDir, fileName);
            await fileController.writeFile(filePath, JSON.stringify(templateData, null, 2));
            
            log(`模板已保存: ${fileName}`, LOG_TYPES.SUCCESS);
            return fileName;
        } catch (error) {
            log(`保存模板失败: ${error.message}`, LOG_TYPES.ERROR);
            throw error;
        }
    }

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
                        nodeCount: content.nodes.length
                    };
                });
        } catch (error) {
            log(`获取模板列表失败: ${error.message}`, LOG_TYPES.ERROR);
            return [];
        }
    }

    async loadTemplate(fileName) {
        try {
            const templateDir = this.getTemplateDir();
            const filePath = path.join(templateDir, fileName);
            const content = await fs.promises.readFile(filePath, 'utf8');
            const templateData = JSON.parse(content);
            
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

            templateData.nodes = templateData.nodes.map(node => {
                if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
                    log(`警告: 节点 ${node.id} 位置信息不完整，使用默认位置`, LOG_TYPES.WARNING);
                    return {
                        ...node,
                        position: { x: 100, y: 100 }
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