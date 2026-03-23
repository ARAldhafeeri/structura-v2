import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";

// ============================================================================
// Walker processors
// Background maintenance handlers that traverse the graph using the same
// depth-first walk logic from core/Walker.ts.
// Mapped from core/Walker.ts
// ============================================================================

export const onGarbageCollection: TaskProcessorHandler = async (_task, ctx) => {
  console.log("WALKER CTX", ctx)
  if (!ctx) return false;

  const allNodes = ctx.graph.getAllNodes();

  // Remove nodes with no edges (orphans) that are also below minimum weight
  const MIN_WEIGHT = 1;
  const orphanIds: string[] = [];

  for (const node of allNodes) {
    const outgoing = ctx.graph.getEdges(node.id);
    const incoming = ctx.graph.getEdges(undefined, node.id);
    if (outgoing.length === 0 && incoming.length === 0 && node.weight < MIN_WEIGHT) {
      orphanIds.push(node.id);
    }
  }

  if (orphanIds.length) {
    ctx.graph.removeNodes(orphanIds);
    for (const id of orphanIds) ctx.cache.delete(id);
  }

  return true;
};

export const onCollectAnalytics: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;

  const stats = ctx.graph.getStats();
  const cacheStats = ctx.cache.getStats();

  // Log lightweight analytics — extend later with telemetry sink
  console.log("[structura:analytics]", {
    graphNodes: stats.nodes,
    graphEdges: stats.edges,
    cacheHits: cacheStats.hits,
    cacheMisses: cacheStats.misses,
    cacheSize: cacheStats.size,
    timestamp: Date.now(),
  });

  return true;
};

export const onSessionLogging: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const event = task.data?.event ?? "unknown";
  const meta = task.data?.meta ?? {};

  console.log("[structura:session]", { event, meta, timestamp: Date.now() });
  return true;
};
