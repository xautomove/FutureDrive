import PythonNodeExecutor from './PythonNodeExecutor';
import { log, LOG_TYPES } from '../../assets/js/utils';
import path from 'path';
import GLOBALS from '../../assets/js/globals';
import fs from 'fs';

class NodeExecutor {
    constructor() {
        this.nodeOutputs = new Map(); // 存储节点输出
        this.executionOrder = []; // 存储执行顺序
        this.pythonExecutor = new PythonNodeExecutor();
    }

    // 构建节点执行顺序
    buildExecutionOrder(nodes, edges) {
        // 构建节点依赖图
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const edgeMap = new Map();
        const inDegree = new Map(); // 记录每个节点的入度

        // 初始化入度
        nodes.forEach(node => inDegree.set(node.id, 0));

        // 构建边的关系并计算入度
        edges.forEach(edge => {
            if (!edgeMap.has(edge.source)) {
                edgeMap.set(edge.source, []);
            }
            edgeMap.get(edge.source).push(edge);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        });

        // 拓扑排序
        const executionOrder = [];
        const queue = [];

        // 将入度为0的节点（起始节点）加入队列
        nodes.forEach(node => {
            if (inDegree.get(node.id) === 0) {
                queue.push(node);
            }
        });

        // 执行拓扑排序
        while (queue.length > 0) {
            const node = queue.shift();
            executionOrder.push(node);

            // 处理当前节点的所有出边
            const outEdges = edgeMap.get(node.id) || [];
            for (const edge of outEdges) {
                const targetId = edge.target;
                inDegree.set(targetId, inDegree.get(targetId) - 1);
                
                // 如果目标节点的入度变为0，加入队列
                if (inDegree.get(targetId) === 0) {
                    const targetNode = nodeMap.get(targetId);
                    if (targetNode) {
                        queue.push(targetNode);
                    }
                }
            }
        }

        return executionOrder;
    }

    // 执行整个流程
    async executeFlow(nodes, edges) {
        console.log(nodes);
        try {
            // 1. 找到所有有连线的节点ID
            const nodeIdsWithEdges = new Set();
            edges.forEach(edge => {
                nodeIdsWithEdges.add(edge.source);
                nodeIdsWithEdges.add(edge.target);
            });
            const isolatedNodes = nodes.filter(node => node.data.type === "任务");
            // 3. fire and forget 启动独立节点
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
            // 4. 只对有连线的节点做原有的调度
            const connectedNodes = nodes.filter(node => nodeIdsWithEdges.has(node.id));
            if (connectedNodes.length === 0) return;
            // 构建节点依赖图
            const nodeMap = new Map(connectedNodes.map(node => [node.id, node]));
            const edgeMap = new Map();
            edges.forEach(edge => {
                if (!edgeMap.has(edge.target)) {
                    edgeMap.set(edge.target, []);
                }
                edgeMap.get(edge.target).push(edge);
            });
            // 获取执行顺序
            const executionOrder = this.buildExecutionOrder(connectedNodes, edges);
            log(`执行顺序: ${executionOrder.map(node => node.id).join(' -> ')}`, LOG_TYPES.INFO);
            // 按顺序执行节点
            for (const node of executionOrder) {
                try {
                    // 获取节点的输入数据
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
                    // 获取节点的配置数据
                    const configData = node.data.config || [];
                    // 执行节点
                    const result = await this.pythonExecutor.execute(node, inputData, configData);
                    // 更新节点的输出数据
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
        console.log('forceStop2');
        this.pythonExecutor.killActiveProcess();
    }
}

export default NodeExecutor; 