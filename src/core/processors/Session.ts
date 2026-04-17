import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import type { ExpansionPolicy } from "../../contract/Graph.js";

// ============================================================================
// Session processors
// Handlers for all user interactions with the graph UI and editor.
// Mapped from core/Session.ts
// ============================================================================

export const onNodeClick: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const node = ctx.graph.getNode(nodeId);
  if (!node) return false;

  const connectedIds = ctx.graph.getEdges(nodeId).map((e) => e.to);
  ctx.webview?.postMessage({ command: "highlight", primary: nodeId, nodeIds: [nodeId, ...connectedIds] });
  return true;
};

export const onNodeDoubleClick: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const parts = nodeId.split(":");
  const filePath = parts[0].replace(/%3A/g, ":");
  const line = Math.max(0, parseInt(parts[1] ?? "1", 10) - 1);
  const col = parseInt(parts[2] ?? "0", 10);

  const vscode = await import("vscode");
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const pos = new vscode.Position(line, col);
  await vscode.window.showTextDocument(doc, { selection: new vscode.Selection(pos, pos) });
  return true;
};

export const onNodeHover: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const node = ctx.graph.getNode(nodeId) ?? ctx.cache.get(nodeId);
  if (!node) return false;

  ctx.webview?.postMessage({
    command: "tooltip",
    nodeId,
    info: { name: node.name, intent: node.intent, weight: node.weight, location: node.location },
  });
  return true;
};

export const onActiveFileChanged: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const filePath: string = task.data?.filePath;
  if (!filePath) return false;

  const fileNodeIds = ctx.graph.getAllNodes()
    .filter((n) => n.id.startsWith(filePath))
    .map((n) => n.id);

  ctx.webview?.postMessage({ command: "focusFile", filePath, nodeIds: fileNodeIds });
  return true;
};

export const onToggleGraph: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx?.webview) return false;
  ctx.webview.isVisible() ? ctx.webview.hide() : ctx.webview.show();
  return true;
};

export const onOpenFileFromNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const parts = nodeId.split(":");
  const filePath = parts[0].replace(/%3A/g, ":");
  const line = Math.max(0, parseInt(parts[1] ?? "1", 10) - 1);

  const vscode = await import("vscode");
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const pos = new vscode.Position(line, 0);
  await vscode.window.showTextDocument(doc, { selection: new vscode.Selection(pos, pos) });
  return true;
};

export const onExpandSelectedNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const policy: ExpansionPolicy = task.data?.policy ?? {
    order: ["import", "export", "definition", "call", "reference", "type"],
    maxDepth: 2,
    maxNodesPerLevel: 15,
    fanOutLimit: 8,
    weightThreshold: 1,
    stopOnCycles: true,
    includeExternal: false,
  };

  const expanded = ctx.graph.expandNode((n) => n.id === nodeId, policy);
  for (const node of expanded) ctx.cache.set(node.id, node);

  const relevantIds = new Set<string>([nodeId, ...expanded.map(n => n.id)]);
  const edges = ctx.graph.getEdges().filter(
    (e) => relevantIds.has(e.from) && relevantIds.has(e.to),
  );

  ctx.webview?.postMessage({ command: "nodesAdded", nodes: expanded, edges });
  return true;
};

export const onDeselectAllNodes: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  ctx.webview?.postMessage({ command: "clearSelection" });
  return true;
};

export const onViewportChange: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const viewport = task.data?.viewport;
  if (!viewport) return false;
  ctx.webview?.postMessage({ command: "viewportAck", viewport });
  return true;
};

export const onNodeDragDrop: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const { nodeId, position } = task.data ?? {};
  if (!nodeId || !position) return false;

  const node = ctx.graph.getNode(nodeId);
  if (!node) return false;

  ctx.graph.updateNode(nodeId, { metadata: { ...node.metadata, position } });
  ctx.webview?.postMessage({ command: "nodePositionUpdated", nodeId, position });
  return true;
};

export const onSelectNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;
  ctx.webview?.postMessage({ command: "selectNode", nodeId });
  return true;
};

export const onPinNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const node = ctx.graph.getNode(nodeId);
  if (!node) return false;

  const pinned = !node.metadata?.pinned;
  ctx.graph.updateNode(nodeId, { metadata: { ...node.metadata, pinned } });
  ctx.webview?.postMessage({ command: "nodePinned", nodeId, pinned });
  return true;
};

export const onHideNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const node = ctx.graph.getNode(nodeId);
  if (node) ctx.cache.set(nodeId, node);

  ctx.graph.removeNode(nodeId);
  ctx.webview?.postMessage({ command: "nodeHidden", nodeId });
  return true;
};
