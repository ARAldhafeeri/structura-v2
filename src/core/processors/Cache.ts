import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";

// ============================================================================
// Cache processors
// Handlers that manage the LRU cache via ctx.cache.
// Mapped from core/Cache.ts
// ============================================================================

export const onUpdateCache: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  // Pull the latest node from the graph and refresh its cache entry
  const node = ctx.graph.getNode(nodeId);
  if (!node) return false;

  ctx.cache.set(nodeId, node);
  return true;
};

export const onClearExpiredCache: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  ctx.cache.clear();
  return true;
};

export const onInvalidateCache: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  ctx.cache.delete(nodeId);
  return true;
};
