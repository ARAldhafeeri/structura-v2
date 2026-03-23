import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";

// ============================================================================
// Semantic processors
// Handlers that manage the in-memory semantic/vector index via ctx.semanticIndex.
// Mapped from core/Semantic.ts
// ============================================================================

export const onBuildSemanticIndex: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  const nodes = ctx.graph.getAllNodes();
  await ctx.semanticIndex.rebuild(nodes);
  return true;
};

export const onUpdateNodeIndex: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  // Embedding may be pre-computed and passed in, otherwise use an empty vector
  const embedding: number[] = task.data?.embedding ?? [];
  if (!nodeId) return false;

  await ctx.semanticIndex.addNode(nodeId, embedding);
  return true;
};

export const onRemoveNodeFromIndex: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  await ctx.semanticIndex.removeNode(nodeId);
  return true;
};

export const onSemanticSearch: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const query: string = task.data?.query;
  const limit: number = task.data?.limit ?? 10;
  if (!query) return false;

  const result = await ctx.semanticIndex.search(query, limit);

  ctx.webview?.postMessage({ command: "searchResults", query, result });
  return true;
};

export const onSearchSuggestions: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const prefix: string = task.data?.prefix ?? "";

  // Fast prefix match against all node names in the graph
  const suggestions = ctx.graph
    .getAllNodes()
    .filter((n) => n.name.toLowerCase().startsWith(prefix.toLowerCase()))
    .slice(0, 20)
    .map((n) => ({ id: n.id, name: n.name, intent: n.intent }));

  ctx.webview?.postMessage({ command: "searchSuggestions", prefix, suggestions });
  return true;
};

export const onClearSemanticIndex: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  await ctx.semanticIndex.clear();
  return true;
};
