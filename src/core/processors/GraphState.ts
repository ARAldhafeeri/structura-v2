import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import type { ExpansionPolicy } from "../../contract/Graph.js";

// ============================================================================
// GraphState processors
// Handlers that directly mutate ctx.graph and drive the webview graph view.
// Mapped from core/GraphState.ts
// ============================================================================

export const onInitializeGraph: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  ctx.graph.clear();
  return true;
};

export const onExpandNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const policy: ExpansionPolicy = task.data?.policy ?? {
    order: ["import", "export", "definition", "call", "reference", "type"],
    maxDepth: 3,
    maxNodesPerLevel: 20,
    fanOutLimit: 10,
    weightThreshold: 1,
    stopOnCycles: true,
    includeExternal: false,
  };

  const expanded = ctx.graph.expandNode((n) => n.id === nodeId, policy);
  for (const node of expanded) ctx.cache.set(node.id, node);

  ctx.webview?.postMessage({ command: "nodesAdded", nodes: expanded });
  return true;
};

export const onCollapseNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  // Remove all outgoing edges — hides children from the view
  const removedEdges = ctx.graph.collapseNode((edge) => edge.from === nodeId);

  // Keep removed targets in cache so re-expansion is cheap
  for (const edge of removedEdges) {
    const child = ctx.graph.getNode(edge.to);
    if (child) ctx.cache.set(child.id, child);
  }

  ctx.webview?.postMessage({
    command: "edgesRemoved",
    edges: removedEdges.map((e) => ({ from: e.from, to: e.to })),
  });
  return true;
};

export const onSendGraphToWebview: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx?.webview) return false;
  const { nodes, edges } = ctx.graph.state;
  ctx.webview.postMessage({ command: "graphData", nodes, edges });
  return true;
};

export const onHighlightNodes: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx?.webview) return false;
  const nodeIds: string[] = task.data?.nodeIds ?? [];
  const color: string = task.data?.color ?? "accent";
  ctx.webview.postMessage({ command: "highlight", nodeIds, color });
  return true;
};

export const onUpdateLayout: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx?.webview) return false;
  const layout: string = task.data?.layout ?? "force";
  ctx.webview.postMessage({ command: "updateLayout", layout });
  return true;
};
