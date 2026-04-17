import type { IGraphState, IStracturaGraphState } from "../contract/State/Graph.js";
import type { ExpansionPolicy, SemanticEdge, SemanticNode } from "../contract/Graph.js";

// ── Change events ─────────────────────────────────────────────────────────────
// Handlers mutate GraphState → GraphState emits typed events →
// webview bridge serialises & posts to the panel for animated rendering.

export type GraphChangeEventType =
  | "nodes-added"
  | "nodes-removed"
  | "nodes-updated"
  | "edges-added"
  | "edges-removed"
  | "cleared";

export interface GraphChangeEvent {
  type: GraphChangeEventType;
  payload?: {
    nodes?: SemanticNode[];
    nodeIds?: string[];
    updates?: Map<string, Partial<SemanticNode>>;
    edges?: SemanticEdge[];
    removedEdges?: Array<{ fromId: string; toId: string }>;
  };
}

export type GraphChangeListener = (event: GraphChangeEvent) => void;

/**
 * GraphState — single source of truth for the Structura graph.
 *
 * All mutations flow:  PriorityQueue → handler → GraphState.mutate() → emit event → webview
 *
 * Internal layout (all O(1) per operation):
 *   nodeMap:    id → SemanticNode
 *   edgeMap:    "from➜to" → SemanticEdge
 *   fromIndex:  fromId → Set<edgeKey>   (outgoing)
 *   toIndex:    toId   → Set<edgeKey>   (incoming, for reverse traversal)
 *
 * The public `state` getter derives plain arrays on demand for serialisation
 * (snapshot, webview serialisation).  Hot-path code uses the Maps directly.
 */
export class GraphState implements IGraphState {
  private readonly nodeMap = new Map<string, SemanticNode>();
  private readonly edgeMap = new Map<string, SemanticEdge>();
  private readonly fromIndex = new Map<string, Set<string>>();
  private readonly toIndex = new Map<string, Set<string>>();

  private listeners: GraphChangeListener[] = [];

  // ── IGraphState.state (derived; cheap for typical graph sizes) ────────────

  get state(): IStracturaGraphState {
    return {
      nodes: Array.from(this.nodeMap.values()),
      edges: Array.from(this.edgeMap.values()),
    };
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /** Subscribe to graph mutations. Returns an unsubscribe function. */
  subscribe(listener: GraphChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: GraphChangeEvent): void {
    for (const l of this.listeners) l(event);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private edgeKey(from: string, to: string): string {
    return `${from}\u27F6${to}`;        // "from➦to"  (U+27F6 avoids path collisions)
  }

  private ensureNodeIndexes(id: string): void {
    if (!this.fromIndex.has(id)) this.fromIndex.set(id, new Set());
    if (!this.toIndex.has(id)) this.toIndex.set(id, new Set());
  }

  // ── Node operations ────────────────────────────────────────────────────────

  getNode(id: string): SemanticNode | undefined {
    return this.nodeMap.get(id);
  }

  getNodes(ids: string[]): SemanticNode[] {
    const result: SemanticNode[] = [];
    for (const id of ids) {
      const n = this.nodeMap.get(id);
      if (n) result.push(n);
    }
    return result;
  }

  getAllNodes(): SemanticNode[] {
    return Array.from(this.nodeMap.values());
  }

  addNode(node: SemanticNode): void {
    this.nodeMap.set(node.id, node);
    this.ensureNodeIndexes(node.id);
    this.emit({ type: "nodes-added", payload: { nodes: [node] } });
  }

  addNodes(nodes: SemanticNode[]): void {
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
      this.ensureNodeIndexes(node.id);
    }
    this.emit({ type: "nodes-added", payload: { nodes } });
  }

  updateNode(id: string, updates: Partial<SemanticNode>): void {
    const existing = this.nodeMap.get(id);
    if (!existing) return;
    this.nodeMap.set(id, { ...existing, ...updates });
    const map = new Map<string, Partial<SemanticNode>>([[id, updates]]);
    this.emit({ type: "nodes-updated", payload: { updates: map } });
  }

  updateNodes(updates: Map<string, Partial<SemanticNode>>): void {
    for (const [id, patch] of updates) {
      const existing = this.nodeMap.get(id);
      if (existing) this.nodeMap.set(id, { ...existing, ...patch });
    }
    this.emit({ type: "nodes-updated", payload: { updates } });
  }

  removeNode(id: string): void {
    if (!this.nodeMap.has(id)) return;
    this.nodeMap.delete(id);
    this._teardownNodeEdges(id);
    this.emit({ type: "nodes-removed", payload: { nodeIds: [id] } });
  }

  removeNodes(ids: string[]): void {
    const removed: string[] = [];
    for (const id of ids) {
      if (!this.nodeMap.has(id)) continue;
      this.nodeMap.delete(id);
      this._teardownNodeEdges(id);
      removed.push(id);
    }
    if (removed.length) this.emit({ type: "nodes-removed", payload: { nodeIds: removed } });
  }

  private _teardownNodeEdges(nodeId: string): void {
    const outgoing = this.fromIndex.get(nodeId);
    if (outgoing) {
      for (const key of outgoing) {
        const e = this.edgeMap.get(key);
        if (e) this.toIndex.get(e.to)?.delete(key);
        this.edgeMap.delete(key);
      }
      this.fromIndex.delete(nodeId);
    }

    const incoming = this.toIndex.get(nodeId);
    if (incoming) {
      for (const key of incoming) {
        const e = this.edgeMap.get(key);
        if (e) this.fromIndex.get(e.from)?.delete(key);
        this.edgeMap.delete(key);
      }
      this.toIndex.delete(nodeId);
    }
  }

  // ── Edge operations ────────────────────────────────────────────────────────

  getEdges(fromId?: string, toId?: string): SemanticEdge[] {
    if (!fromId && !toId) return Array.from(this.edgeMap.values());

    if (fromId && !toId) {
      const keys = this.fromIndex.get(fromId);
      if (!keys) return [];
      return [...keys].map((k) => this.edgeMap.get(k)!).filter(Boolean);
    }

    if (!fromId && toId) {
      const keys = this.toIndex.get(toId);
      if (!keys) return [];
      return [...keys].map((k) => this.edgeMap.get(k)!).filter(Boolean);
    }

    const edge = this.edgeMap.get(this.edgeKey(fromId!, toId!));
    return edge ? [edge] : [];
  }

  getEdgesBetween(fromId: string, toId: string): SemanticEdge[] {
    const edge = this.edgeMap.get(this.edgeKey(fromId, toId));
    return edge ? [edge] : [];
  }

  addEdge(edge: SemanticEdge): void {
    const key = this.edgeKey(edge.from, edge.to);
    this.edgeMap.set(key, edge);
    this.ensureNodeIndexes(edge.from);
    this.ensureNodeIndexes(edge.to);
    this.fromIndex.get(edge.from)!.add(key);
    this.toIndex.get(edge.to)!.add(key);
    this.emit({ type: "edges-added", payload: { edges: [edge] } });
  }

  addEdges(edges: SemanticEdge[]): void {
    for (const edge of edges) {
      const key = this.edgeKey(edge.from, edge.to);
      this.edgeMap.set(key, edge);
      this.ensureNodeIndexes(edge.from);
      this.ensureNodeIndexes(edge.to);
      this.fromIndex.get(edge.from)!.add(key);
      this.toIndex.get(edge.to)!.add(key);
    }
    this.emit({ type: "edges-added", payload: { edges } });
  }

  removeEdge(fromId: string, toId: string): void {
    const key = this.edgeKey(fromId, toId);
    if (!this.edgeMap.has(key)) return;
    this.edgeMap.delete(key);
    this.fromIndex.get(fromId)?.delete(key);
    this.toIndex.get(toId)?.delete(key);
    this.emit({ type: "edges-removed", payload: { removedEdges: [{ fromId, toId }] } });
  }

  removeEdges(edges: Array<{ fromId: string; toId: string }>): void {
    const removed: Array<{ fromId: string; toId: string }> = [];
    for (const { fromId, toId } of edges) {
      const key = this.edgeKey(fromId, toId);
      if (!this.edgeMap.has(key)) continue;
      this.edgeMap.delete(key);
      this.fromIndex.get(fromId)?.delete(key);
      this.toIndex.get(toId)?.delete(key);
      removed.push({ fromId, toId });
    }
    if (removed.length) this.emit({ type: "edges-removed", payload: { removedEdges: removed } });
  }

  // ── Query: expand / collapse ───────────────────────────────────────────────

  /**
   * Expand seed nodes (matched by predicate) up to policy limits.
   * Returns the newly discovered neighbour nodes (not the seeds themselves).
   *
   * Walk strategy: BFS from seeds, respecting:
   *   maxDepth          — levels of traversal
   *   maxNodesPerLevel  — cap per BFS level
   *   fanOutLimit       — cap per source node per level
   *   weightThreshold   — skip nodes below this weight
   *   stopOnCycles      — skip already-visited nodes
   *   order             — intent priority; higher-priority intents are explored first
   */
  expandNode(
    predicate: (node: SemanticNode) => boolean,
    policy: ExpansionPolicy,
    direction: 'forward' | 'reverse' = 'forward',
  ): SemanticNode[] {
    const seeds = this.getAllNodes().filter(predicate);
    if (!seeds.length) return [];

    const { maxDepth, maxNodesPerLevel, fanOutLimit, weightThreshold, stopOnCycles, order } = policy;

    const visited = new Set<string>(seeds.map((n) => n.id));
    const result: SemanticNode[] = [];

    let frontier = seeds.map((n) => n.id);

    // Forward: follow outgoing edges (what the node imports/uses).
    // Reverse: follow incoming edges (who imports/uses this node).
    const index = direction === 'reverse' ? this.toIndex : this.fromIndex;
    const neighborId = (edge: SemanticEdge) =>
      direction === 'reverse' ? edge.from : edge.to;

    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const nextFrontier: string[] = [];
      let levelCount = 0;

      for (const nodeId of frontier) {
        if (levelCount >= maxNodesPerLevel) break;

        const outKeys = index.get(nodeId);
        if (!outKeys?.size) continue;

        // Collect, filter, sort candidates for this source node
        const candidates: SemanticNode[] = [];
        for (const key of outKeys) {
          const edge = this.edgeMap.get(key);
          if (!edge) continue;
          const target = this.nodeMap.get(neighborId(edge));
          if (!target) continue;
          if (stopOnCycles && visited.has(target.id)) continue;
          if (target.weight < weightThreshold) continue;
          candidates.push(target);
        }

        // Sort: explicit intent order first, then descending weight
        candidates.sort((a, b) => {
          const ai = order.length ? order.indexOf(a.intent) : -1;
          const bi = order.length ? order.indexOf(b.intent) : -1;
          const aRank = ai === -1 ? order.length : ai;
          const bRank = bi === -1 ? order.length : bi;
          if (aRank !== bRank) return aRank - bRank;
          return b.weight - a.weight;
        });

        let fanOut = 0;
        for (const target of candidates) {
          if (fanOut >= fanOutLimit) break;
          if (levelCount >= maxNodesPerLevel) break;
          if (visited.has(target.id)) continue;

          visited.add(target.id);
          result.push(target);
          nextFrontier.push(target.id);
          fanOut++;
          levelCount++;
        }
      }

      frontier = nextFrontier;
    }

    return result;
  }

  /**
   * Remove edges matching the predicate from the live view.
   * Returns the removed edges so the caller can decide whether
   * to also purge orphaned nodes.
   */
  collapseNode(predicate: (edge: SemanticEdge) => boolean): SemanticEdge[] {
    const removed: SemanticEdge[] = [];

    for (const edge of this.edgeMap.values()) {
      if (predicate(edge)) removed.push(edge);
    }

    for (const edge of removed) {
      const key = this.edgeKey(edge.from, edge.to);
      this.edgeMap.delete(key);
      this.fromIndex.get(edge.from)?.delete(key);
      this.toIndex.get(edge.to)?.delete(key);
    }

    if (removed.length) {
      this.emit({
        type: "edges-removed",
        payload: { removedEdges: removed.map((e) => ({ fromId: e.from, toId: e.to })) },
      });
    }

    return removed;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Wipe everything — used on workspace close or full refresh. */
  clear(): void {
    this.nodeMap.clear();
    this.edgeMap.clear();
    this.fromIndex.clear();
    this.toIndex.clear();
    this.emit({ type: "cleared" });
  }

  getStats(): { nodes: number; edges: number } {
    return { nodes: this.nodeMap.size, edges: this.edgeMap.size };
  }
}
