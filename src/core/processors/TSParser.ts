import fs from "fs/promises";
import path from "path";
import { parseSync } from "oxc-parser";
import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import { extractSemanticNodes, type SemanticParseResult } from "../TSParser.js";
import { getDirectoryTree } from "../Directory.js";
import type { SemanticEdge, SemanticNode } from "../../contract/Graph.js";
import type { ImportEdgeStub } from "../Visitors.js";

// ============================================================================
// TSParser processors
// Handlers that parse source files into semantic nodes and push them into the
// graph + cache.  Edge formation is done in the visitor layer (Visitors.ts):
//   - Contains edges (file Program → definition) are emitted per visitor.
//   - Import stubs (cross-file edges) are resolved here after all files are
//     parsed, because TypeScript emits .js import paths that refer to .ts files.
// File discovery is always routed through getDirectoryTree so that depth is
// controlled — incremental expansion is a core Structura trait.
// ============================================================================

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

/**
 * Resolve the full absolute path of a FILE entry returned by getDirectoryTree.
 */
function resolveFilePath(item: { path: string; type: string; parent: string }): string {
  return path.join(process.cwd(), item.parent, item.path);
}

export async function parseFile(filePath: string): Promise<SemanticParseResult> {
  const source = await fs.readFile(filePath, "utf-8");
  const ast = parseSync(filePath, source, { sourceType: "module" });
  return extractSemanticNodes(ast.program, filePath, source);
}

/**
 * Resolve cross-file import stubs into concrete SemanticEdges.
 *
 * Stubs carry a normalised resolved base path (no extension, lowercase,
 * forward-slashes).  We build the same normalised key from every Program node
 * in the graph and match stubs against it — handling the .js→.ts mismatch
 * that TypeScript introduces at the source level.
 */
export function resolveImportStubs(
  stubs: ImportEdgeStub[],
  nodes: SemanticNode[],
): SemanticEdge[] {
  // Build a map: normalisedPath → Program node ID
  const programByNorm = new Map<string, string>();
  for (const n of nodes) {
    if (n.metadata?.nodeType !== "Program") continue;
    const encodedPath = n.id.split(":")[0];
    const absPath = encodedPath.replace(/%3A/g, ":");
    const norm = absPath.replace(/\.[jt]sx?$/i, "").toLowerCase().replace(/\\/g, "/");
    programByNorm.set(norm, n.id);
  }

  const edges: SemanticEdge[] = [];
  const seen = new Set<string>();
  for (const stub of stubs) {
    const toProgramId = programByNorm.get(stub.toResolvedBase);
    if (!toProgramId) continue;

    // File-level edge: FileA:Program → FileB:Program (for file-dependency view).
    const progKey = `${stub.fromProgramId}→${toProgramId}`;
    if (!seen.has(progKey)) {
      seen.add(progKey);
      edges.push({ from: stub.fromProgramId, to: toProgramId, weight: stub.weight });
    }

    // Import-node edge: ImportDeclaration → FileB:Program (so expanding the import reveals the file).
    if (stub.fromImportNodeId) {
      const impKey = `${stub.fromImportNodeId}→${toProgramId}`;
      if (!seen.has(impKey)) {
        seen.add(impKey);
        edges.push({ from: stub.fromImportNodeId, to: toProgramId, weight: stub.weight });
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
  const depth: number = task.data?.depth ?? 1; // always better visuals 
  const ignorePatterns: string[] = task.data?.ignorePatterns ?? [];

  const tree = await getDirectoryTree(rootDir, depth);
  const sourceFiles = tree
    .filter((item) => {
      if (item.type !== "F" || !isSourceFile(item.path)) return false;
      if (ignorePatterns.some(p => item.parent.includes(p) || item.path.includes(p))) return false;
      return true;
    })
    .map(resolveFilePath);

  const allNodes: SemanticNode[] = [];
  const allEdges: SemanticEdge[] = [];
  const allStubs: ImportEdgeStub[] = [];

  await Promise.all(
    sourceFiles.map(async (filePath) => {
      try {
        const result = await parseFile(filePath);
        for (const node of result.nodes) ctx.cache.set(node.id, node);
        allNodes.push(...result.nodes);
        allEdges.push(...result.edges);
        allStubs.push(...result.importStubs);
      } catch {
        // skip unparseable files silently
      }
    }),
  );

  ctx.graph.addNodes(allNodes);
  // Add intra-file contains edges emitted by visitors
  ctx.graph.addEdges(allEdges);
  // Resolve and add cross-file import edges
  ctx.graph.addEdges(resolveImportStubs(allStubs, allNodes));
  return true;
};

/**
 * Parse a single file and add its nodes and edges to the graph.
 * task.data.filePath — absolute path to the file
 */
export const onParseFile: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const filePath: string = task.data?.filePath;
  if (!filePath || !isSourceFile(filePath)) return false;

  let result: SemanticParseResult;
  try {
    result = await parseFile(filePath);
  } catch {
    return false;
  }

  ctx.graph.addNodes(result.nodes);
  for (const node of result.nodes) ctx.cache.set(node.id, node);
  ctx.graph.addEdges(result.edges);
  // Re-resolve stubs against the full graph so new import targets are found
  ctx.graph.addEdges(resolveImportStubs(result.importStubs, ctx.graph.getAllNodes()));
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
  const allEdges: SemanticEdge[] = [];
  const allStubs: ImportEdgeStub[] = [];

  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const result = await parseFile(filePath);
        for (const node of result.nodes) ctx.cache.set(node.id, node);
        allNodes.push(...result.nodes);
        allEdges.push(...result.edges);
        allStubs.push(...result.importStubs);
      } catch {
        // skip silently
      }
    }),
  );

  ctx.graph.addNodes(allNodes);
  ctx.graph.addEdges(allEdges);
  ctx.graph.addEdges(resolveImportStubs(allStubs, ctx.graph.getAllNodes()));
  return true;
};
