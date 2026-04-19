import path from "path";
import { parseSync } from "oxc-parser";
import fs from "fs/promises";
import { getDirectoryTree } from "../Directory.js";
import { extractSemanticNodes } from "../TSParser.js";
import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import type { SemanticEdge, SemanticNode } from "../../contract/Graph.js";

// ============================================================================
// Directory processors
// Handlers that use getDirectoryTree to drive depth-controlled, incremental
// expansion of the workspace into the graph.
// Mapped from core/Directory.ts
// ============================================================================

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function resolveFilePath(item: { path: string; type: string; parent: string }): string {
  return path.join(process.cwd(), item.parent, item.path);
}

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

/**
 * Expand the graph one directory level deeper from a given directory.
 * This is the primary mechanism for Structura's incremental expansion —
 * the user or system triggers this to reveal more of the codebase on demand.
 *
 * task.data.dir    — directory to expand from
 * task.data.depth  — how many levels to walk (defaults to 1 — one step at a time)
 */
export const onExpandDirectory: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const dir: string = task.data?.dir ?? process.cwd();
  const depth: number = task.data?.depth ?? 1;

  const tree = await getDirectoryTree(dir, depth);
  const sourceFiles = tree
    .filter((item) => item.type === "F" && SOURCE_EXTENSIONS.has(path.extname(item.path)))
    .map(resolveFilePath)
    .filter((fp) => !ctx.graph.getAllNodes().some((n) => n.id.startsWith(fp)));

  const freshNodes: SemanticNode[] = [];
  await Promise.all(
    sourceFiles.map(async (filePath) => {
      try {
        const source = await fs.readFile(filePath, "utf-8");
        const ast = parseSync(filePath, source, { sourceType: "module" });
        const {nodes, edges, importStubs} = extractSemanticNodes(ast.program, filePath, source);
        for (const node of nodes) ctx.cache.set(node.id, node);
        freshNodes.push(...nodes);
        
      } catch {
        // skip unparseable files silently
      }
    }),
  );

  if (freshNodes.length) {
    const drivenEdges = deriveEdges(ctx.graph.getAllNodes());
    ctx.graph.addNodes(freshNodes);
    ctx.graph.addEdges(drivenEdges);
    ctx.webview?.postMessage({ command: "nodesAdded", nodes: freshNodes , edges: drivenEdges});

  }

  return true;
};

/**
 * Send the raw directory tree for a given path to the webview without parsing.
 * Useful for rendering a file-tree panel alongside the graph.
 *
 * task.data.dir    — directory to list
 * task.data.depth  — levels to include (defaults to 1)
 */
export const onListDirectory: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx?.webview) return false;
  const dir: string = task.data?.dir ?? process.cwd();
  const depth: number = task.data?.depth ?? 1;

  const tree = await getDirectoryTree(dir, depth);
  ctx.webview.postMessage({ command: "directoryTree", dir, tree });
  return true;
};
