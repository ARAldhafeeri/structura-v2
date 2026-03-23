import type { ExpansionPolicy, SemanticEdge, SemanticNode } from "../Graph.js";
import type { CacheStats } from "./Cache.js";




/**
 * Stractura graph state the back-bone, single source of truth that connect
 * backend of stractura to frontend. 
 * Backend will mutate the state object based on dispached queue events of processors.
 * The frontend ( vs code web view ) will display those mutation in animated visually appealing way.
 */
export interface IStracturaGraphState  {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
}


/**
 * Graph state methods and utilties.
 * Stractura have centrilized state which sets between 
 * Frotend ( VS code extension) and backend which is
 * event-driven queue and handlers. 
 * When state mutates or transition 
 * The user see visually appealing animated
 * reaction on the graph
 */

/**
 * The graph state
 */
export interface IStructuraGraphStateState {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
}

export interface IGraphState {
  // State should be properly typed
  state: IStracturaGraphState;
  
  // Node operations
  getNode(id: string): SemanticNode | undefined;
  getNodes(ids: string[]): SemanticNode[];  // Batch retrieval
  getAllNodes(): SemanticNode[];
  addNode(node: SemanticNode): void;
  addNodes(nodes: SemanticNode[]): void;  // Batch addition
  updateNode(id: string, updates: Partial<SemanticNode>): void;
  updateNodes(updates: Map<string, Partial<SemanticNode>>): void;  // Batch updates
  removeNode(id: string): void;
  removeNodes(ids: string[]): void;  // Batch removal
  
  // Edge operations
  getEdges(fromId?: string, toId?: string): SemanticEdge[];  // Add filtering
  getEdgesBetween(fromId: string, toId: string): SemanticEdge[];  // Specific pair
  addEdge(edge: SemanticEdge): void;
  addEdges(edges: SemanticEdge[]): void;  // Batch addition
  removeEdge(fromId: string, toId: string): void;
  removeEdges(edges: Array<{fromId: string, toId: string}>): void;  // Batch removal
  
  // Query operations
  /**
   * expand node based on expansion policy
   * @param predicate 
   */
  expandNode(predicate: (node: SemanticNode) => boolean, expansionPolicy: ExpansionPolicy): SemanticNode[];
  /**
   * Shrink all children of a node ( delete them from user view)
   * @param predicate 
   */
  collapseNode(predicate: (edge: SemanticEdge) => boolean): SemanticEdge[];
  

  /** 
   * Wipe everything — used on workspace close or full refresh. 
   * */

  clear(): void;

  /**
   * Simple stats method return just the number of nodes and edges but extendable 
   */
  getStats(): { nodes: number; edges: number } 
}
