import fs from "fs/promises";
import path from "path";
import { parseSync } from "oxc-parser";
import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import { extractSemanticNodes } from "../TSParser.js";
import { getDirectoryTree } from "../Directory.js";
import type { SemanticEdge, SemanticNode } from "../../contract/Graph.js";

// ============================================================================
// TSParser processors
// Handlers that parse source files into semantic nodes and push them into the
// graph + cache.  File discovery is always routed through getDirectoryTree so
// that depth is controlled — incremental expansion is a core Structura trait.
// Mapped from core/TSParser.ts
// ============================================================================

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

/**
 * Resolve the full absolute path of a FILE entry returned by getDirectoryTree.
 * FILE entries carry only the basename alongside a parent that is relative to
 * process.cwd() (as computed by getDirectoryTree).  Using the same process.cwd()
 * to reconstruct is correct because the relative path arithmetic cancels out.
 */
function resolveFilePath(item: { path: string; type: string; parent: string }): string {
  return path.join(process.cwd(), item.parent, item.path);
}

async function parseToNodes(filePath: string): Promise<SemanticNode[]> {
  const source = await fs.readFile(filePath, "utf-8");
  const ast = parseSync(filePath, source, { sourceType: "module" });
  return extractSemanticNodes(ast.program, filePath, source);
}

/** Derive import→export edges from the nodes currently in the graph. */
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
 * Build the initial graph from a root directory at a controlled depth.
 * task.data.rootDir  — directory to start from (defaults to cwd)
 * task.data.depth    — how many directory levels to expand (0 = unbounded)
 *                      defaults to 1 so only the immediate root is parsed first
 */
export const onBuildInitialGraph: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const rootDir: string = task.data?.rootDir ?? process.cwd();
  const depth: number = task.data?.depth ?? 1;

  const tree = await getDirectoryTree(rootDir, depth);
  const sourceFiles = tree
    .filter((item) => item.type === "F" && isSourceFile(item.path))
    .map(resolveFilePath);

  const allNodes: SemanticNode[] = [];
  await Promise.all(
    sourceFiles.map(async (filePath) => {
      try {
        const nodes = await parseToNodes(filePath);
        for (const node of nodes) ctx.cache.set(node.id, node);
        allNodes.push(...nodes);
      } catch {
        // skip unparseable files silently
      }
    }),
  );

  ctx.graph.addNodes(allNodes);
  ctx.graph.addEdges(deriveEdges(allNodes));
  return true;
};

/**
 * Parse a single file and add its nodes to the graph.
 * task.data.filePath — absolute path to the file
 */
export const onParseFile: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const filePath: string = task.data?.filePath;
  if (!filePath || !isSourceFile(filePath)) return false;

  let nodes: SemanticNode[];
  try {
    nodes = await parseToNodes(filePath);
  } catch {
    return false;
  }

  ctx.graph.addNodes(nodes);
  for (const node of nodes) ctx.cache.set(node.id, node);
  ctx.graph.addEdges(deriveEdges(ctx.graph.getAllNodes()));
  return true;
};

/**
 * Parse a batch of explicitly listed files (not a directory scan).
 * task.data.filePaths — string[]
 */
export const onBatchProcessFiles: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const filePaths: string[] = (task.data?.filePaths ?? []).filter(isSourceFile);
  if (!filePaths.length) return false;

  const allNodes: SemanticNode[] = [];
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const nodes = await parseToNodes(filePath);
        for (const node of nodes) ctx.cache.set(node.id, node);
        allNodes.push(...nodes);
      } catch {
        // skip silently
      }
    }),
  );

  ctx.graph.addNodes(allNodes);
  ctx.graph.addEdges(deriveEdges(ctx.graph.getAllNodes()));
  return true;
};
