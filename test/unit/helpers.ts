import sinon from "sinon";
import type { IProcessorContext } from "../../src/contract/TaskProcessor.js";
import type { SemanticNode, SemanticEdge } from "../../src/contract/Graph.js";
import type { PriorityTask } from "../../src/contract/PriorityTaskQueue.js";

// ── Node / Edge fixtures ──────────────────────────────────────────────────────

export const makeNode = (id: string, overrides: Partial<SemanticNode> = {}): SemanticNode => ({
  id,
  intent: "definition",
  name: id,
  location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
  weight: 3,
  metadata: { nodeType: "FunctionDeclaration" },
  ...overrides,
});

export const makeEdge = (from: string, to: string): SemanticEdge => ({ from, to, weight: 1 });

// ── Task fixture ──────────────────────────────────────────────────────────────

export const makeTask = (subType: string, data: Record<string, any> = {}): PriorityTask => ({
  id: `test:${subType}:${Date.now()}`,
  type: "graph-construction",
  subType,
  priority: 6000,
  subPriority: 0,
  data,
  createdAt: Date.now(),
});

// ── Ctx mock factory ──────────────────────────────────────────────────────────

export const buildCtx = (graphNodes: SemanticNode[] = [], graphEdges: SemanticEdge[] = []): IProcessorContext => {
  const graph = {
    state: { nodes: graphNodes, edges: graphEdges },
    getNode: sinon.stub().callsFake((id: string) => graphNodes.find((n) => n.id === id)),
    getNodes: sinon.stub().callsFake((ids: string[]) => graphNodes.filter((n) => ids.includes(n.id))),
    getAllNodes: sinon.stub().callsFake(() => [...graphNodes]),
    addNode: sinon.stub().callsFake((n: SemanticNode) => graphNodes.push(n)),
    addNodes: sinon.stub().callsFake((ns: SemanticNode[]) => graphNodes.push(...ns)),
    updateNode: sinon.stub().callsFake((id: string, patch: Partial<SemanticNode>) => {
      const i = graphNodes.findIndex((n) => n.id === id);
      if (i !== -1) Object.assign(graphNodes[i], patch);
    }),
    updateNodes: sinon.stub(),
    removeNode: sinon.stub().callsFake((id: string) => {
      const i = graphNodes.findIndex((n) => n.id === id);
      if (i !== -1) graphNodes.splice(i, 1);
    }),
    removeNodes: sinon.stub().callsFake((ids: string[]) => {
      for (const id of ids) {
        const i = graphNodes.findIndex((n) => n.id === id);
        if (i !== -1) graphNodes.splice(i, 1);
      }
    }),
    getEdges: sinon.stub().callsFake((fromId?: string, toId?: string) => {
      if (!fromId && !toId) return [...graphEdges];
      if (fromId && !toId) return graphEdges.filter((e) => e.from === fromId);
      if (!fromId && toId) return graphEdges.filter((e) => e.to === toId);
      return graphEdges.filter((e) => e.from === fromId && e.to === toId);
    }),
    getEdgesBetween: sinon.stub().callsFake((from: string, to: string) =>
      graphEdges.filter((e) => e.from === from && e.to === to),
    ),
    addEdge: sinon.stub().callsFake((e: SemanticEdge) => graphEdges.push(e)),
    addEdges: sinon.stub().callsFake((es: SemanticEdge[]) => graphEdges.push(...es)),
    removeEdge: sinon.stub(),
    removeEdges: sinon.stub(),
    expandNode: sinon.stub().returns([]),
    collapseNode: sinon.stub().returns([]),
    clear: sinon.stub().callsFake(() => { graphNodes.length = 0; graphEdges.length = 0; }),
    getStats: sinon.stub().callsFake(() => ({ nodes: graphNodes.length, edges: graphEdges.length })),
  };

  const cache = {
    get: sinon.stub().returns(undefined),
    set: sinon.stub(),
    has: sinon.stub().returns(false),
    delete: sinon.stub(),
    clear: sinon.stub(),
    getStats: sinon.stub().returns({ hits: 0, misses: 0, size: 0, lastUpdated: Date.now() }),
  };

  const semanticIndex = {
    search: sinon.stub().resolves({ matches: [], score: 0 }),
    addNode: sinon.stub().resolves(),
    removeNode: sinon.stub().resolves(),
    rebuild: sinon.stub().resolves(),
    clear: sinon.stub().resolves(),
  };

  const session = {
    get: sinon.stub().returns(undefined),
    set: sinon.stub().resolves(),
    delete: sinon.stub().resolves(),
    purge: sinon.stub().resolves(),
    purgeAll: sinon.stub().resolves(),
    list: sinon.stub().returns([]),
    rename: sinon.stub().resolves(),
    getMetadata: sinon.stub().returns(undefined),
    loadPersistedSessions: sinon.stub().resolves(),
  };

  const settings = {
    get: sinon.stub().returns(undefined),
    set: sinon.stub(),
    getAll: sinon.stub().returns({ "structura.depth": 1 }),
  };

  const webview = {
    postMessage: sinon.stub(),
    onMessage: sinon.stub(),
    show: sinon.stub(),
    hide: sinon.stub(),
    isVisible: sinon.stub().returns(false),
  };

  return {
    graph: graph as any,
    cache: cache as any,
    semanticIndex: semanticIndex as any,
    session: session as any,
    settings: settings as any,
    webview: webview as any,
    editor: {} as any,
  };
};
