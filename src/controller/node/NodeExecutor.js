import PythonNodeExecutor from './PythonNodeExecutor';
import { log, LOG_TYPES } from '../../assets/js/utils';
import GLOBALS from '../../assets/js/globals';

function startDebugWatcher(uuid, node) {
    if (GLOBALS.debugWatchers.some(w => w.uuid === uuid)) return;

    const debugKey = `task_debug:${uuid}`;
    const bgKey = `task_bg:${uuid}`;
    
    const intervalId = setInterval(async () => {
        try {
            if (GLOBALS.redisController && GLOBALS.redisController.isConnected()) {
                const debugInfo = await GLOBALS.redisController.get(debugKey);
                const bgStatus = await GLOBALS.redisController.get(bgKey);
                
                let logEntry = GLOBALS.nodeLogs.find(item => item.uuid === uuid);
                if (!logEntry) {
                    logEntry = {
                        uuid,
                        label: node.data.label,
                        input: {},
                        output: null,
                        config: node.data.config || {},
                        debug: debugInfo,
                        time: new Date().toLocaleString(),
                        error: false,
                        hasBackgroundProcess: bgStatus == '1'
                    };
                    GLOBALS.nodeLogs.push(logEntry);
                } else {
                    logEntry.debug = debugInfo;
                    logEntry.hasBackgroundProcess = bgStatus == '1';
                }
            }
        } catch (error) {
            console.error('Debug watcher error:', error);
        }
    }, 1000);

    GLOBALS.debugWatchers.push({ uuid, intervalId });
}

class NodeExecutor {
    constructor() {
        this.nodeOutputs = new Map();
        this.executionOrder = [];
        this.pythonExecutor = new PythonNodeExecutor();
        this.pollingInterval = null;
        this.isPolling = false;
        this.activeProcesses = [];
    }

    buildExecutionOrder(nodes, edges) {
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const edgeMap = new Map();
        const inDegree = new Map();

        nodes.forEach(node => inDegree.set(node.id, 0));

        edges.forEach(edge => {
            if (!edgeMap.has(edge.source)) {
                edgeMap.set(edge.source, []);
            }
            edgeMap.get(edge.source).push(edge);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        });

        const executionOrder = [];
        const queue = [];

        nodes.forEach(node => {
            if (inDegree.get(node.id) === 0) {
                queue.push(node);
            }
        });

        queue.sort((a, b) => {
            const priorityA = a.data.priority || 0;
            const priorityB = b.data.priority || 0;
            return priorityB - priorityA;
        });

        while (queue.length > 0) {
            const node = queue.shift();
            executionOrder.push(node);

            const outEdges = edgeMap.get(node.id) || [];
            for (const edge of outEdges) {
                const targetId = edge.target;
                inDegree.set(targetId, inDegree.get(targetId) - 1);
                
                if (inDegree.get(targetId) === 0) {
                    const targetNode = nodeMap.get(targetId);
                    if (targetNode) {
                        queue.push(targetNode);
                    }
                }
            }

            queue.sort((a, b) => {
                const priorityA = a.data.priority || 0;
                const priorityB = b.data.priority || 0;
                return priorityB - priorityA;
            });
        }

        return executionOrder;
    }

    async executeFlow(nodes, edges) {
        try {
            this.nodes = nodes;
            this.edges = edges;
            this.nodeMap = new Map(nodes.map(node => [node.id, node]));
            
            this.executionOrder = this.buildExecutionOrder(nodes, edges);
            
            if (this.executionOrder.length === 0) {
                log('没有可执行的节点', LOG_TYPES.WARNING);
                return;
            }
            
            this.startPollingService();
            
            await this.executeNextNode();
            
        } catch (error) {
            log(`执行流程失败: ${error.message}`, LOG_TYPES.ERROR);
        }
    }

    async executeNextNode() {
        for (const node of this.executionOrder) {
            const uuid = node.data.uuid;
            if (!uuid){
                log(`节点没有UUID: ${node.data.label}`, LOG_TYPES.ERROR);
                continue;
            };
            if (await this.isNodeReady(node)) {
                try {
                    node._startTime = new Date();
                    await GLOBALS.redisController.set(`task_status:${uuid}`, 'running');
                    const inputData = await this.prepareNodeInput(node);
                    node._lastInputData = inputData;
                    const configData = node.data.config || [];
                    const child = this.pythonExecutor.execute(node, inputData, configData);
                    GLOBALS.addProcess(uuid, child);
                    startDebugWatcher(uuid, node);
                    break;
                } catch (error) {
                    log(`准备节点执行失败: ${node.data.label} - ${error.message}`, LOG_TYPES.ERROR);
                }
            }else{
                log(`节点未准备好执行: ${node.data.label}`, LOG_TYPES.WARNING);
            }
        }
    }

    async isNodeReady(node) {
        const nodeMap = new Map();
        for (const n of this.executionOrder) {
            nodeMap.set(n.id, n);
        }
        
        for (const edge of this.edges || []) {
            if (edge.target === node.id) {
                const sourceNode = nodeMap.get(edge.source);
                if (sourceNode) {
                    const sourceUuid = sourceNode.data.uuid;
                    if (sourceUuid) {
                        const status = await GLOBALS.redisController.get(`task_status:${sourceUuid}`);
                        if (status !== 'finish') {
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }

    // 准备节点的输入数据
    async prepareNodeInput(node) {
        const inputData = {};
        // 根据节点连接关系准备输入数据
        for (const edge of this.edges || []) {
            if (edge.target === node.id) {
                const sourceNode = this.nodeMap.get(edge.source);
                let outputValue;
                if (sourceNode && sourceNode.data.outputs) {
                    // 优先用内存
                    const sourceOutputIndex = parseInt(edge.sourceHandle.split('-')[1]);
                    if (sourceNode.data.outputs[sourceOutputIndex]) {
                        outputValue = sourceNode.data.outputs[sourceOutputIndex].value;
                        if (node.data.inputs) {
                            const targetInputIndex = parseInt(edge.targetHandle.split('-')[1]);
                            if (node.data.inputs[targetInputIndex]) {
                                const inputName = node.data.inputs[targetInputIndex].name;
                                inputData[inputName] = outputValue;
                            }
                        }
                        continue;
                    }
                }
            }
        }
        return inputData;
    }

    // 启动轮询服务
    startPollingService() {
        if (this.isPolling) {
            return;
        }
        
        this.isPolling = true;
        this.pollingInterval = setInterval(async () => {
            try {
                await this.checkNodeStatus();
            } catch (error) {
                log(`轮询检查失败: ${error.message}`, LOG_TYPES.ERROR);
            }
        }, 500); // 0.5秒轮询间隔
        
        log('轮询服务已启动', LOG_TYPES.INFO);
    }

    // 停止轮询服务
    stopPollingService() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        log('轮询服务已停止', LOG_TYPES.INFO);
    }

    // 处理节点结果（完成或错误）
    async handleNodeResult(node, uuid, status) {
        try {
            const outputKey = `task_result:${uuid}`;
            const debugKey = `task_debug:${uuid}`;
            const outputData = await GLOBALS.redisController.get(outputKey);
            const debugInfo = await GLOBALS.redisController.get(debugKey);
            const inputData = node._lastInputData || {};
            const configData = node.data.config || {};
            const endTime = new Date();
            const startTime = node._startTime || endTime;
            const duration = endTime - startTime;
            let logEntry = GLOBALS.nodeLogs.find(item => item.uuid === uuid);
            if (!logEntry) {
                logEntry = {
                    uuid,
                    label: node.data.label,
                    input: inputData,
                    output: status === 'completed' ? outputData : null,
                    config: configData,
                    debug: debugInfo,
                    time: new Date().toLocaleString(),
                    error: status === 'error',
                    status,
                    startTime: startTime.toLocaleString(),
                    endTime: endTime.toLocaleString(),
                    duration: `${duration}ms`
                };
                GLOBALS.nodeLogs.push(logEntry);
            } else {
                logEntry.output = status === 'completed' ? outputData : null;
                logEntry.debug = debugInfo;
                logEntry.error = status === 'error';
                logEntry.status = status;
                logEntry.endTime = endTime.toLocaleString();
                logEntry.duration = `${duration}ms`;
            }
            GLOBALS.removeProcess(uuid);
            // 不再删除redis数据，不再stopDebugWatcher
            if (status === 'completed' && outputData) {
                node.data.outputs = node.data.outputs.map(output => ({
                    ...output,
                    value: outputData[output.name]
                }));
                log(`节点执行完成: ${node.data.label}`, LOG_TYPES.SUCCESS);
            } else if (status === 'error') {
                log(`节点执行出错: ${node.data.label}`, LOG_TYPES.ERROR);
            }
            // 从执行队列中移除
            const index = this.executionOrder.findIndex(n => n.data.uuid === uuid); // 使用data.uuid
            if (index !== -1) {
                this.executionOrder.splice(index, 1);
            }
            // 尝试执行下一个节点
            await this.executeNextNode();
            // 如果所有节点都完成了，停止轮询
            if (this.executionOrder.length === 0) {
                this.stopPollingService();
                log('所有节点执行完成', LOG_TYPES.SUCCESS);
            }
        } catch (error) {
            log(`处理节点结果失败: ${error.message}`, LOG_TYPES.ERROR);
        }
    }

    // 检查节点状态
    async checkNodeStatus() {
        if (!GLOBALS.redisController || !GLOBALS.redisController.isConnected()) {
            console.log('redis not connected');
            this.stopPollingService();
            return;
        }
        for (const node of this.executionOrder) {
            const uuid = node.data.uuid; // 使用data.uuid
            if (!uuid){
                log(`节点没有UUID: ${node.data.label}`, LOG_TYPES.ERROR);
                continue;
            };
            const statusKey = `task_status:${uuid}`;
            const status = await GLOBALS.redisController.get(statusKey);
            if (status === 'finish') {
                await this.handleNodeResult(node, uuid, 'completed');
            } else if (status === 'error') {
                await this.handleNodeResult(node, uuid, 'error');
            }
        }
    }

    // 强制终止流程
    async forceStop() {
        this.stopPollingService();
        this.pythonExecutor.killActiveProcess();
        GLOBALS.clearProcesses();
        GLOBALS.stopAllDebugWatchers();
    }
}

export default NodeExecutor; 