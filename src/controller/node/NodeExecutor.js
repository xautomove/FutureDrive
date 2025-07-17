import PythonNodeExecutor from './PythonNodeExecutor';
import { log, LOG_TYPES } from '../../assets/js/utils';

class NodeExecutor {
    constructor() {
        this.nodeOutputs = new Map();
        this.executionOrder = [];
        this.pythonExecutor = new PythonNodeExecutor();
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
        console.log(nodes);
        try {
            const nodeIdsWithEdges = new Set();
            edges.forEach(edge => {
                nodeIdsWithEdges.add(edge.source);
                nodeIdsWithEdges.add(edge.target);
            });
            const isolatedNodes = nodes.filter(node => node.data.type === "任务");
            for (const node of isolatedNodes) {
                const configData = node.data.config || [];
                this.pythonExecutor.execute(node, {}, configData)
                    .then(result => {
                        node.data.outputs = node.data.outputs.map(output => ({
                            ...output,
                            value: result.outputs[output.name]
                        }));
                        log(`任务节点执行完成: ${node.data.label}`, LOG_TYPES.SUCCESS);
                    })
                    .catch(error => {
                        log(`任务节点执行失败: ${node.data.label} - ${error.message}`, LOG_TYPES.ERROR);
                    });
            }
            const connectedNodes = nodes.filter(node => nodeIdsWithEdges.has(node.id));
            if (connectedNodes.length === 0) return;
            const nodeMap = new Map(connectedNodes.map(node => [node.id, node]));
            const edgeMap = new Map();
            edges.forEach(edge => {
                if (!edgeMap.has(edge.target)) {
                    edgeMap.set(edge.target, []);
                }
                edgeMap.get(edge.target).push(edge);
            });
            const executionOrder = this.buildExecutionOrder(connectedNodes, edges);
            log(`执行顺序: ${executionOrder.map(node => `${node.data.label}(P:${node.data.priority || 0})`).join(' -> ')}`, LOG_TYPES.INFO);
            for (const node of executionOrder) {
                try {
                    const inputData = {};
                    const inputEdges = edgeMap.get(node.id) || [];
                    for (const edge of inputEdges) {
                        const sourceNode = nodeMap.get(edge.source);
                        const sourceOutput = sourceNode.data.outputs[edge.sourceHandle.split('-')[1]];
                        const targetInput = node.data.inputs[edge.targetHandle.split('-')[1]];
                        if (sourceOutput && targetInput) {
                            inputData[targetInput.name] = sourceOutput.value;
                        }
                    }
                    const configData = node.data.config || [];
                    const result = await this.pythonExecutor.execute(node, inputData, configData);
                    if (result && result.outputs) {
                        node.data.outputs = node.data.outputs.map(output => ({
                            ...output,
                            value: result.outputs[output.name]
                        }));
                    }
                } catch (error) {
                    log(`节点执行失败: ${node.data.label} - ${error.message}`, LOG_TYPES.ERROR);
                    throw error;
                }
            }
        } catch (error) {
            if(error.message.indexOf('Traceback') === -1){
                log(`流程执行失败: ${error.message}`, LOG_TYPES.ERROR);
            }
            throw error;
        }
    }

    // 强制终止流程
    async forceStop() {
        this.pythonExecutor.killActiveProcess();
    }
}

export default NodeExecutor; 