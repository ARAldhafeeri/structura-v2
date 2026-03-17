import type { CacheStats } from "./Cache.js";
import type { SemanticEdge, SemanticGraph, SemanticNode } from "./Graph.js";
import type { SemanticSearchResult } from "./SemanticSearch.js";
import type { ViewportState } from "./ViewPort.js";


/**
 * In-memory state of stractura graph, time travel is through snapshotting.
 */
export interface IGraphState {
  getNode(id: string): SemanticNode | undefined;
  getAllNodes(): SemanticNode[];
  addNode(node: SemanticNode): void;
  updateNode(id: string, updates: Partial<SemanticNode>): void;
  removeNode(id: string): void;
  getEdges(fromId?: string): SemanticEdge[];
  addEdge(edge: SemanticEdge): void;
  removeEdge(fromId: string, toId: string): void;
  getSubgraph(rootId: string, depth: number): SemanticGraph;
  serialize(): SemanticGraph;
  deserialize(data: SemanticGraph): void;
}

/**
 * We cache only frequently accessed nodes and their neighbors for better user experience
 * We will decide frequently accessed nodes through bloom filter.
 */
export interface ICacheState {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  getStats(): CacheStats;
}

export interface ISessionState {
  getActiveFile(): string | null;
  setActiveFile(path: string | null): void;
  getSelectedNodes(): string[];
  setSelectedNodes(nodeIds: string[]): void;
  getViewport(): ViewportState;
  setViewport(viewport: ViewportState): void;
  pushToHistory(state: any): void;
  undo(): any;
  redo(): any;
}

export interface ISemanticIndexState {
  search(query: string, limit?: number): SemanticSearchResult[];
  addNode(nodeId: string, embedding: number[]): void;
  removeNode(nodeId: string): void;
  rebuild(nodes: SemanticNode[]): void;
  clear(): void;
}
