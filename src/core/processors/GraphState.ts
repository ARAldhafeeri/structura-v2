import path from "path";
import fs from "fs/promises";
import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";
import type { ExpansionPolicy, SemanticEdge, SemanticNode } from "../../contract/Graph.js";
import type { ImportEdgeStub } from "../Visitors.js";
import { fileProgramId } from "../Visitors.js";
import { parseFile, resolveImportStubs } from "./TSParser.js";
import { getFilePathFromNodeId } from "../../uitlities/state.js";

// ============================================================================
// GraphState processors
// Handlers that directly mutate ctx.graph and drive the webview graph view.
// ============================================================================

// Directories that are never useful to scan for importers or full-graph builds.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.vscode-test', '.vscode', '__pycache__', '.turbo', '.next', '.nuxt',
]);

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Fast recursive file walker that prunes ignored directories during the walk
 * (unlike getDirectoryTree which recurses everywhere then filters).
 */
async function walkSourceFiles(
  dir: string,
  extraSkip: Set<string>,
  results: string[] = [],
): Promise<string[]> {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return results; }

  await Promise.all(entries.map(async entry => {
    if (SKIP_DIRS.has(entry.name) || extraSkip.has(entry.name)) return;
    if (entry.name.startsWith('.')) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkSourceFiles(full, extraSkip, results);
    } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }));
  return results;
}

/**
 * Node types shown by default in the webview (legend categories that are
 * checked on load).  Anything NOT in this set is stored in the graph but
 * withheld from the webview until the user enables that legend category.
 */
const CORE_NODE_TYPES = new Set([
  // Files
  "Program",
  // Classes & Types
  "ClassDeclaration", "TSInterfaceDeclaration", "TSEnumDeclaration",
  "TSTypeAliasDeclaration", "TSModuleDeclaration",
  // Functions
  "FunctionDeclaration", "MethodDefinition", "GeneratorFunction",
  // Imports & Exports
  "ImportDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration",
  "ExportAllDeclaration", "TSExportAssignment", "TSImportEqualsDeclaration",
]);

const DEFAULT_EXPANSION_POLICY: ExpansionPolicy = {
  order: ["import", "export", "definition", "call", "reference", "type"],
  maxDepth: 3,
  maxNodesPerLevel: 20,
  fanOutLimit: 10,
  weightThreshold: 1,
  stopOnCycles: true,
  includeExternal: false,
};

export const onInitializeGraph: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  ctx.graph.clear();
  return true;
};

export const onExpandNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const targetNode = ctx.graph.getNode(nodeId);

  console.log("[stractura:processor:onExpandNode]", "target Node", targetNode)

  // External package imports are display-only — never explore node_modules.
  if (targetNode?.metadata?.isExternal) {
      console.log("[stractura:processor:onExpandNode]", "Node is external", targetNode)

    ctx.webview?.postMessage({ command: "nodesAdded", nodes: [], edges: [], reason: "external" });
    return true;
  }

  // ImportDeclaration with no cross-file edge yet → parse the target file on-demand
  // and wire ImportDeclaration → imported Program node.
  if (targetNode?.metadata?.nodeType === "ImportDeclaration") {
  console.log("[stractura:processor:onExpandNode]", "Node type -> ImportDeclaration", )

    const hasProgramEdge = ctx.graph
      .getEdges(nodeId)
      .some(e => ctx.graph.getNode(e.to)?.metadata?.nodeType === "Program");

    if (!hasProgramEdge) {
      const source: string | undefined = targetNode.metadata?.source;
      const nodeMatch = nodeId.match(/^(.+):\d+:\d+:/);
      if (source?.startsWith(".") && nodeMatch) {
        const importingFile = nodeMatch[1].replace(/%3A/g, ":");
        const base = path.resolve(path.dirname(importingFile), source).replace(/\.js$/i, "");
        for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
          const resolved = base + ext;
          try {
            const programId = fileProgramId(resolved);
            if (!ctx.graph.getNode(programId)) {
              const result = await parseFile(resolved);
              for (const n of result.nodes) ctx.cache.set(n.id, n);
              ctx.graph.addNodes(result.nodes);
              ctx.graph.addEdges(result.edges);
              ctx.graph.addEdges(resolveImportStubs(result.importStubs, ctx.graph.getAllNodes()));


            }
            const programId2 = fileProgramId(resolved);
            if (ctx.graph.getNode(programId2)) {
              ctx.graph.addEdge({ from: nodeId, to: programId2, weight: 4 });
            }
        
            break;
          } catch { /* try next extension */ }
        }
      }
    }
  }

  // Program node with no outgoing edges → file hasn't been parsed yet; load it now.
  if (targetNode?.metadata?.nodeType === "Program") {
      console.log("[stractura:processor:onExpandNode]", "Node type -> Program", )

    const hasEdges = ctx.graph.getEdges(nodeId).length > 0;
    if (!hasEdges) {
      
      const filePath = getFilePathFromNodeId(nodeId);
      console.log("[stractura:processor:onExpandNode]", "file path: ", filePath )

      try {
        const result = await parseFile(filePath);
        for (const n of result.nodes) ctx.cache.set(n.id, n);
        console.log("[stractura:processor:onExpandNode]", "parse file results: ", `nodes no. ${result.nodes.length}`, `edges no. ${result.edges.length}`, `stubs no. ${result.importStubs.length}`)

        ctx.graph.addNodes(result.nodes);
        ctx.graph.addEdges(result.edges);
        ctx.graph.addEdges(resolveImportStubs(result.importStubs, ctx.graph.getAllNodes()));
        // Only send core node types to the webview — detail categories (members,
        // control-flow, calls, variables) are fetched on-demand via expand-category.
        const coreNodes = result.nodes.filter(n => CORE_NODE_TYPES.has(n.metadata?.nodeType as string));
        const coreIds = new Set(coreNodes.map(n => n.id));
        const coreEdges = result.edges.filter(e => coreIds.has(e.from) || coreIds.has(e.to));
        console.log("[stractura:processor:onExpandNode]", "Using bridge to update user view")
        ctx.webview?.postMessage({ command: "nodesAdded", nodes: coreNodes, edges: coreEdges, reason: "expand command" });
      } catch { /* skip unparseable */ }
    }
  }

  const policy: ExpansionPolicy = task.data?.policy ?? DEFAULT_EXPANSION_POLICY;

  const expanded = ctx.graph.expandNode((n) => n.id === nodeId, policy);
  for (const node of expanded) ctx.cache.set(node.id, node);

  // Filter to core types only — detail nodes are delivered via expand-category.
  const coreExpanded = expanded.filter(n => CORE_NODE_TYPES.has(n.metadata?.nodeType as string));
  const coreExpandedIds = new Set<string>([nodeId, ...coreExpanded.map(n => n.id)]);
  const edges = ctx.graph.getEdges().filter(
    (e) => coreExpandedIds.has(e.from) && coreExpandedIds.has(e.to),
  );

  ctx.webview?.postMessage({ command: "nodesAdded", nodes: coreExpanded, edges });
  return true;
};

/**
 * Expand a node in the reverse direction — find all files that import the
 * file containing the selected node.
 *
 * Because the initial graph only covers a shallow slice of the workspace,
 * this handler walks the full project (skipping node_modules etc.), parses
 * any un-seen files that import the target, adds them to the graph, then
 * runs a reverse BFS so the webview receives real results.
 *
 * The BFS always targets the **Program node** of the selected file regardless
 * of which node type the user has selected — importers only have edges to the
 * file root, not to individual methods/classes.
 */
export const onExpandNodeImporters: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  // Decode the absolute file path from the nodeId (works for any node type).
  // nodeId format:  encodedAbsPath:line:col:NodeType
  const nodeMatch = nodeId.match(/^(.+):(\d+):(\d+):[^:]+$/);
  if (!nodeMatch) {
    ctx.webview?.postMessage({ command: "nodesAdded", nodes: [], edges: [] });
    return true;
  }
  const targetFilePath = nodeMatch[1].replace(/%3A/g, ":");

  // The Program node is the file root — importers' edges point here.
  const programId = fileProgramId(targetFilePath);

  // Normalised path used by importStubs (no extension, lowercase, forward-slashes).
  const targetNorm = targetFilePath
    .replace(/\.[jt]sx?$/i, "")
    .toLowerCase()
    .replace(/\\/g, "/");

  // ── Fast path: importers already in the graph (toIndex populated) ──────────
  const alreadyKnown = ctx.graph.getEdges(undefined, programId);

  if (!alreadyKnown.length) {
    // ── Workspace scan ─────────────────────────────────────────────────────
    // Walk from process.cwd() (workspace root in VS Code extension context),
    // pruning ignored directories during the walk itself so node_modules is
    // never traversed.
    const extraIgnore = new Set<string>(task.data?.ignorePatterns ?? []);
    const candidates = await walkSourceFiles(process.cwd(), extraIgnore);

    const nodesToAdd: SemanticNode[] = [];
    const edgesToAdd: SemanticEdge[] = [];
    const stubsToResolve: ImportEdgeStub[] = [];

    await Promise.all(candidates.map(async (filePath) => {
      // Skip files whose Program node is already in the graph.
      if (ctx.graph.getNode(fileProgramId(filePath))) return;
      try {
        const result = await parseFile(filePath);
        // Only include files that actually import the target.
        const importsTarget = result.importStubs.some(
          stub => stub.toResolvedBase === targetNorm,
        );
        if (!importsTarget) return;
        for (const node of result.nodes) ctx.cache.set(node.id, node);
        nodesToAdd.push(...result.nodes);
        edgesToAdd.push(...result.edges);
        stubsToResolve.push(...result.importStubs);
      } catch { /* skip unparseable files */ }
    }));

    if (nodesToAdd.length) {
      ctx.graph.addNodes(nodesToAdd);
      ctx.graph.addEdges(edgesToAdd);
      ctx.graph.addEdges(resolveImportStubs(stubsToResolve, ctx.graph.getAllNodes()));
    }
  }

  // ── Reverse BFS from the Program node ──────────────────────────────────────
  // maxDepth:1 returns only direct importers (files one hop away).
  const policy: ExpansionPolicy = {
    order: ["import", "export", "definition", "call", "reference", "type"],
    maxDepth: 1,
    maxNodesPerLevel: 50,
    fanOutLimit: 50,
    weightThreshold: 1,
    stopOnCycles: true,
    includeExternal: false,
  };

  const expanded = ctx.graph.expandNode(n => n.id === programId, policy, "reverse");

  // Only surface Program nodes (file-level importers) — not their sub-nodes.
  const importerPrograms = expanded.filter(n => n.metadata?.nodeType === "Program");
  for (const node of importerPrograms) ctx.cache.set(node.id, node);

  const relevantIds = new Set<string>([programId, ...importerPrograms.map(n => n.id)]);
  const edges = ctx.graph.getEdges().filter(
    e => relevantIds.has(e.from) && relevantIds.has(e.to),
  );

  ctx.webview?.postMessage({ command: "nodesAdded", nodes: importerPrograms, edges });
  return true;
};

export const onCollapseNode: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeId: string = task.data?.nodeId;
  if (!nodeId) return false;

  const removedEdges = ctx.graph.collapseNode((edge) => edge.from === nodeId);

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

/**
 * Parse the entire workspace and send all Program nodes + cross-file edges
 * to the webview as a single `workspaceReady` message.
 *
 * Design decisions to avoid freezing / draining compute:
 *  - Uses walkSourceFiles (prunes ignored dirs, no node_modules traversal)
 *  - Parses files concurrently with Promise.all
 *  - Resolves stubs once after all files are parsed (single pass)
 *  - Posts only Program-level nodes (one per file) — not every sub-node —
 *    so Cytoscape renders a clean file-dependency graph, not thousands of nodes
 *  - Sub-nodes are stored in ctx.graph and ctx.cache for on-demand expansion
 */
export const onBuildFullGraph: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;

  const extraIgnore = new Set<string>(task.data?.ignorePatterns ?? []);
  const candidates = await walkSourceFiles(process.cwd(), extraIgnore);

  const allNodes: SemanticNode[] = [];
  const allEdges: SemanticEdge[] = [];
  const allStubs: ImportEdgeStub[] = [];

  await Promise.all(candidates.map(async (filePath) => {
    // Skip already-parsed files.
    if (ctx.graph.getNode(fileProgramId(filePath))) return;
    try {
      const result = await parseFile(filePath);
      for (const node of result.nodes) ctx.cache.set(node.id, node);
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
      allStubs.push(...result.importStubs);
    } catch { /* skip unparseable */ }
  }));

  // Merge into graph (all nodes, intra-file edges, cross-file import edges).
  ctx.graph.addNodes(allNodes);
  ctx.graph.addEdges(allEdges);
  const crossFileEdges = resolveImportStubs(allStubs, ctx.graph.getAllNodes());
  ctx.graph.addEdges(crossFileEdges);

  // Send only Program nodes to the webview — one node per file.
  // Users can expand any file node to see its internals.
  const programNodes = ctx.graph.getAllNodes().filter(
    n => n.metadata?.nodeType === "Program",
  );

  // Cross-file import edges (between Program nodes only).
  const programIds = new Set(programNodes.map(n => n.id));
  const fileEdges = ctx.graph.getEdges().filter(
    e => programIds.has(e.from) && programIds.has(e.to),
  );

  ctx.webview?.postMessage({
    command: "workspaceReady",
    nodes: programNodes,
    edges: fileEdges,
    totalFiles: programNodes.length,
  });
  return true;
};

/**
 * Expand a legend category on-demand.
 *
 * The frontend sends the set of nodeTypes it wants to reveal and the IDs of
 * nodes that are currently visible in cy.  The backend finds all graph nodes
 * whose type is in that set AND whose direct parent (via a weight=1 contains
 * edge) is already visible, then delivers them via `nodesAdded`.
 *
 * Only nodes already present in ctx.graph are searched — no extra parsing is
 * triggered here; files are parsed lazily when their Program node is expanded.
 */
export const onExpandCategory: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const nodeTypes: string[] = task.data?.nodeTypes ?? [];
  const visibleNodeIds: Set<string> = new Set(task.data?.visibleNodeIds ?? []);

  if (!nodeTypes.length) return false;
  const typeSet = new Set(nodeTypes);

  // Collect candidate nodes of the requested types.
  const candidates = ctx.graph.getAllNodes().filter(
    n => n.metadata?.nodeType && typeSet.has(n.metadata.nodeType as string),
  );

  // Only include a node if at least one of its contains-parents (weight=1
  // incoming edge) is currently visible in the webview.
  const nodesToSend: SemanticNode[] = [];
  for (const node of candidates) {
    const incoming = ctx.graph.getEdges(undefined, node.id);
    const hasVisibleParent = incoming.some(e => e.weight === 1 && visibleNodeIds.has(e.from));
    if (hasVisibleParent) nodesToSend.push(node);
  }

  if (!nodesToSend.length) {
    ctx.webview?.postMessage({ command: 'nodesAdded', nodes: [], edges: [], reason: 'no-nodes-in-category' });
    return true;
  }

  // Send all edges that connect visible nodes to the new nodes, or among new nodes.
  const newIds = new Set(nodesToSend.map(n => n.id));
  const allRelevant = new Set([...visibleNodeIds, ...newIds]);
  const edges = ctx.graph.getEdges().filter(
    e => allRelevant.has(e.from) && newIds.has(e.to),
  );

  ctx.webview?.postMessage({ command: 'nodesAdded', nodes: nodesToSend, edges });
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
