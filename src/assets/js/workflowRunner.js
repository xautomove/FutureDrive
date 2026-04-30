import config from './config';
import GLOBALS from './globals';
import { log, LOG_TYPES } from './utils';

async function setStartupErrorState(message) {
  await GLOBALS.updateRuntimeState({
    workflow: {
      status: 'error',
      message,
      updatedAt: new Date().toISOString()
    },
    vehicle: {
      status: 'error',
      message,
      updatedAt: new Date().toISOString()
    },
    task: {
      status: 'error',
      message,
      updatedAt: new Date().toISOString()
    }
  });
}

export async function runWorkflow() {
  const redisConfig = config.get('redis') || {};
  if (!redisConfig.enabled) {
    log('请先在设置中启用 Redis 缓存功能', LOG_TYPES.WARNING);
    await setStartupErrorState('Redis 未启用，无法自动运行工作流');
    throw new Error('redis_disabled');
  }

  if (!GLOBALS.redisController || !GLOBALS.redisController.isConnected()) {
    log('Redis 未连接，无法启动工作流', LOG_TYPES.WARNING);
    await setStartupErrorState('Redis 未连接，无法自动运行工作流');
    throw new Error('redis_not_connected');
  }

  const nodes = window.flowNodes || [];
  const edges = window.flowEdges || [];

  if (nodes.length === 0) {
    log('没有可执行的节点', LOG_TYPES.WARNING);
    await setStartupErrorState('当前工作流没有可执行节点');
    throw new Error('no_nodes');
  }

  await GLOBALS.updateRuntimeState({
    workflow: {
      status: 'workflow_starting',
      message: '工作流启动中',
      updatedAt: new Date().toISOString()
    },
    vehicle: {
      status: 'service_connected',
      message: '通讯已连接，等待节点启动完成',
      updatedAt: new Date().toISOString()
    },
    task: {
      status: 'starting',
      message: '任务链路启动中',
      updatedAt: new Date().toISOString()
    }
  });

  log('开始执行流程...', LOG_TYPES.INFO);
  await GLOBALS.nodeController.start(nodes, edges);
}

export async function runWorkflowFromAutoStart() {
  const nodes = window.flowNodes || [];
  const edges = window.flowEdges || [];
  const autoStartNodes = nodes.filter((node) => Boolean(node?.data?.autoStart));

  if (autoStartNodes.length === 0) {
    await setStartupErrorState('当前模板未配置自启节点');
    throw new Error('no_autostart_node');
  }

  if (autoStartNodes.length > 1) {
    await setStartupErrorState('当前模板存在多个自启节点，请仅保留一个入口节点');
    throw new Error('multiple_autostart_nodes');
  }

  await runWorkflow();
}
