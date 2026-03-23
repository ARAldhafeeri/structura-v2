import fs from "fs/promises";
import path from "path";
import { parseSync } from "oxc-parser";
import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import { extractSemanticNodes } from "../TSParser.js";
import { getDirectoryTree } from "../Directory.js";
import type { SemanticEdge, SemanticNode } from "../../contract/Graph.js";

// ============================================================================
// FileWatcher processors
// Handlers that respond to file-system events dispatched by GraphFileWatcher.
// Mapped from core/FileWatcher.ts
// ============================================================================

/** Re-derive edges for the full current graph after a file mutation. */
function deriveEdges(nodes: SemanticNode[]): SemanticEdge[] {
  const exportsByFile = new Map<string, SemanticNode[]>();
  for (const n of nodes) {
    if (n.intent === "export" || n.intent === "definition") {
      const file = n.id.split(":")[0];
      if (!exportsByFile.has(file)) exportsByFile.set(file, []);
      exportsByFile.get(file)!.push(n);
    }
  }
  const edges: SemanticEdge[] = [];
  for (const n of nodes) {
    if (n.intent === "import" && n.target) {
      for (const target of exportsByFile.get(n.target) ?? []) {
        edges.push({ from: n.id, to: target.id, weight: 4 });
      }
    }
  }
  return edges;
}

export const onFileChange: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const filePath: string = task.data?.filePath;
  const changeType: "create" | "update" | "delete" = task.data?.changeType ?? "update";
  if (!filePath) return false;

  if (changeType === "delete") {
    const staleIds = ctx.graph.getAllNodes()
      .filter((n) => n.id.startsWith(filePath))
      .map((n) => n.id);
    ctx.graph.removeNodes(staleIds);
    for (const id of staleIds) ctx.cache.delete(id);
    await ctx.semanticIndex.removeNode(filePath);
    return true;
  }

  // create or update: re-parse the file
  let source: string;
  try {
    source = await fs.readFile(filePath, "utf-8");
  } catch {
    return false;
  }

  const ast = parseSync(filePath, source, { sourceType: "module" });
  const freshNodes = extractSemanticNodes(ast.program, filePath, source);

  // Remove stale nodes for this file
  const staleIds = ctx.graph.getAllNodes()
    .filter((n) => n.id.startsWith(filePath))
    .map((n) => n.id);
  ctx.graph.removeNodes(staleIds);
  for (const id of staleIds) ctx.cache.delete(id);

  // Add fresh nodes and refresh edges
  ctx.graph.addNodes(freshNodes);
  for (const node of freshNodes) ctx.cache.set(node.id, node);
  ctx.graph.addEdges(deriveEdges(ctx.graph.getAllNodes()));

  // Keep semantic index in sync
  await ctx.semanticIndex.rebuild(ctx.graph.getAllNodes());
  return true;
};

/**
 * Prefetch the immediate neighbours of a node's directory using getDirectoryTree
 * at depth=1 — one controlled level at a time, not an unbounded scan.
 * task.data.nodeId — the node whose directory neighbourhood to prefetch
 * task.data.depth  — how many extra levels to expand (defaults to 1)
 */
export const onPrefetchFiles: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const node = ctx.graph.getNode(nodeId) ?? ctx.cache.get(nodeId);
  if (!node) return false;

  const filePath = nodeId.split(":")[0].replace(/%3A/g, ":");
  const dir = path.dirname(filePath);
  const depth: number = task.data?.depth ?? 1;

  const tree = await getDirectoryTree(dir, depth);
  const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

  const candidateFiles = tree
    .filter((item) => item.type === "F" && SOURCE_EXTENSIONS.has(path.extname(item.path)))
    .map((item) => path.join(process.cwd(), item.parent, item.path))
    .filter((fp) => !ctx.graph.getAllNodes().some((n) => n.id.startsWith(fp)));

  await Promise.all(
    candidateFiles.map(async (fp) => {
      try {
        const source = await fs.readFile(fp, "utf-8");
        const ast = parseSync(fp, source, { sourceType: "module" });
        const nodes = extractSemanticNodes(ast.program, fp, source);
        ctx.graph.addNodes(nodes);
        for (const n of nodes) ctx.cache.set(n.id, n);
      } catch {
        // prefetch failures are non-critical
      }
    }),
  );

  return true;
};
