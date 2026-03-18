import type { SemanticNode } from "../Graph.js";

/**
 * Simple contract for cache stats within structura simple recently modes, edges accessed cache implementation.
 */
export type CacheStats = { size: number; hits: number; misses: number; lastUpdated: number };


/**
 * We cache only frequently accessed nodes and their neighbors for better user experience.
 * We will use LRU cache to limit memory for this cache functionality
 */
/**
 * Doubly linked list to implement LRU cache.
 */
export interface ICacheListNode {
  /**
   * Node file path, nodes are parsed programming lanaguge files.
   * picking files path to ease the cache invalidation.
   */
  key: string;
  value: SemanticNode;
  /**
   * Also unique file paths as you cannot have same name of file within a directory with the same extension
   */
  prev: ICacheListNodePointer
  next: ICacheListNodePointer;
}

export type ICacheListNodePointer = ICacheListNode | null;



/**
 * Methods and utilities to manage LRU cache.
 */
export interface ICacheState {
  /**
   * Class properties to impelemnt LRU 
   */
  // capacity is the maximum number of nodes
  capacity: number;
  // head is the most accessed item
  head: ICacheListNodePointer;
  // tail is the least accessed 
  // which will be removed when cache size is hit.
  tail: ICacheListNodePointer;

  // get single node with key
  get(key: string): SemanticNode | undefined;
  // set single node with key
  set(key: string, value: SemanticNode, ttl?: number): void;
  // check if node exists
  has(key: string): boolean;
  // delete single node by key
  delete(key: string): void;
  // purge all the cached nodes
  clear(): void;
  // get stats of the cache.
  getStats(): CacheStats;
}
