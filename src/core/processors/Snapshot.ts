import { SnapshotState } from "../Snapshot.js";
import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";

// ============================================================================
// Snapshot processors
// Handlers that persist / restore graph state via ctx.session + SnapshotState.
// Mapped from core/Snapshot.ts
// ============================================================================

const DEFAULT_SESSION = "default";

export const onSaveState: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const sessionId: string = task.data?.sessionId ?? DEFAULT_SESSION;

  // Ensure the session exists
  if (!ctx.session.get(sessionId)) {
    await ctx.session.set(sessionId);
  }

  const snapshot = ctx.session.get(sessionId);
  if (!snapshot) return false;

  const key = `save:${Date.now()}`;
  await snapshot.persist(key, ctx.graph.state);
  return true;
};

export const onLoadState: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  await ctx.session.loadPersistedSessions();
  return true;
};

export const onCreateSnapshot: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const sessionId: string = task.data?.sessionId ?? DEFAULT_SESSION;
  const label: string = task.data?.label ?? `snapshot:${Date.now()}`;

  if (!ctx.session.get(sessionId)) {
    await ctx.session.set(sessionId);
  }

  const snapshot = ctx.session.get(sessionId);
  if (!snapshot) return false;

  await snapshot.persist(label, ctx.graph.state);
  return true;
};

export const onRestoreSnapshot: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const sessionId: string = task.data?.sessionId ?? DEFAULT_SESSION;
  const key: string = task.data?.key;
  if (!key) return false;

  const snapshot = ctx.session.get(sessionId);
  if (!snapshot) return false;

  const graphData = await snapshot.getSnapshot(key);
  if (!graphData?.nodes) return false;

  ctx.graph.clear();
  ctx.graph.addNodes(graphData.nodes ?? []);
  ctx.graph.addEdges(graphData.edges ?? []);

  ctx.webview?.postMessage({ command: "graphData", nodes: graphData.nodes, edges: graphData.edges });
  return true;
};

export const onUndo: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const sessionId: string = task.data?.sessionId ?? DEFAULT_SESSION;

  const snapshot = ctx.session.get(sessionId);
  if (!snapshot?.head) return false;

  // Walk to the node just before the tail (previous snapshot)
  let curr = snapshot.head;
  let prev = null;
  while (curr?.next) {
    prev = curr;
    curr = curr.next;
  }

  const targetNode = prev ?? snapshot.head;
  const graphData = await snapshot.getSnapshot(targetNode.key);
  if (!graphData?.nodes) return false;

  ctx.graph.clear();
  ctx.graph.addNodes(graphData.nodes ?? []);
  ctx.graph.addEdges(graphData.edges ?? []);

  ctx.webview?.postMessage({ command: "graphData", nodes: graphData.nodes, edges: graphData.edges });
  return true;
};

export const onRedo: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const sessionId: string = task.data?.sessionId ?? DEFAULT_SESSION;

  const snapshot = ctx.session.get(sessionId);
  if (!snapshot?.tail) return false;

  // Tail is the most recent snapshot — use it for redo
  const graphData = await snapshot.getSnapshot(snapshot.tail.key);
  if (!graphData?.nodes) return false;

  ctx.graph.clear();
  ctx.graph.addNodes(graphData.nodes ?? []);
  ctx.graph.addEdges(graphData.edges ?? []);

  ctx.webview?.postMessage({ command: "graphData", nodes: graphData.nodes, edges: graphData.edges });
  return true;
};
