const { app } = window.require('@electron/remote');
const fs = window.require('fs');
const path = window.require('path');
import GLOBALS from '../../assets/js/globals';

class NodeScanner {
    constructor() {
        this.nodeDir = path.join(GLOBALS.USERDATA_DIR, 'node');
    }

    scanNodes() {
        try {
            const nodes = [];
            
            if (!fs.existsSync(this.nodeDir)) {
                fs.mkdirSync(this.nodeDir, { recursive: true });
                return nodes;
            }

            const dirs = fs.readdirSync(this.nodeDir);

            dirs.forEach(dir => {
                const nodePath = path.join(this.nodeDir, dir);
                
                if (fs.statSync(nodePath).isDirectory()) {
                    const configPath = path.join(nodePath, 'config.json');
                    const mainPath = path.join(nodePath, 'main.py');

                    if (fs.existsSync(configPath) && fs.existsSync(mainPath)) {
                        try {
                            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                            nodes.push({
                                data: config,
                                path: dir
                            });
                        } catch (error) {
                            console.error(`Error reading config for ${dir}:`, error);
                        }
                    }
                }
            });

            return nodes;
        } catch (error) {
            console.error('Error scanning nodes:', error);
            return [];
        }
    }
}

export default NodeScanner; 