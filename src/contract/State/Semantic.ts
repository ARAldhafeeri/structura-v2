import type { SemanticNode } from "../Graph.js";
export type SemanticSearchResult = {  score: number; matches: any };

/**
 * Methods of semantic search state the semantic index will be maintained for only active within graph nodes.
 * We will use in memory chromadb for simplicity.
 */
export interface ISemanticIndexState {
  addNode(nodeId: string, embedding: number[]): void;
  removeNode(nodeId: string): void;
  rebuild(nodes: SemanticNode[]): void;
  clear(): void;
}

/**
 * Methods to manage the semantic full-text search
 * note: the semantic search index for performance
 * is going to be maintained only for current 
 * within the graph nodes
 */
export interface ISemanticIndexState {
  search(query: string, limit?: number, threshold?: number): Promise<SemanticSearchResult>;  // Add threshold
  addNode(nodeId: string, embedding: number[]): void;
// ?  addNodes(nodes: Array<{id: string, embedding: number[]}>): void;  // Batch addition
  // removeNode(nodeId: string): void;
  // removeNodes(nodeIds: string[]): void;  // Batch removal
  rebuild(nodes: SemanticNode[]): void;
  clear(): void;
  
  // Suggested additions
  // getSimilarNodes(nodeId: string, limit?: number): SemanticSearchResult[];
  // getNodeEmbedding(nodeId: string): number[] | undefined;
  // updateNodeEmbedding(nodeId: string, embedding: number[]): void;
}