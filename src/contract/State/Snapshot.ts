
/**
 * Snapshot state which is doubly linked list of snapshot files 
 */

import type { SemanticNode } from "../Graph.js";
import type { ICacheListNode } from "./Cache.js";

/**
 * Doubly linked list to implement snapshotting controller.
 */
export interface ISnapshotNode {
  /**
   * file path, to sync snapshotting controller to cache controller 
   */
  key: string;
  /**
   * Previous and Next snapshot node to the current one.
   */
  prev: ISnapshotNode | null;
  next: ISnapshotNode | null;
}

export interface IStracturaSnapshotState {
  /**
   * Class properties to impelemnt LRU 
   */
  // capacity is the maximum number of nodes
  capacity: number;
  // head is the most accessed item
  head: ICacheListNode | null;
  // tail is the least accessed 
  // which will be removed when cache size is hit.
  tail: ICacheListNode | null;
  // get single node with key
  get<T = SemanticNode>(key: string): T | undefined;
  // set single node with key
  set<T = SemanticNode>(key: string, value: T, ttl?: number): void;
  // check if node exists
  has(key: string): boolean;
  // delete single node by key
  delete(key: string): void;
  // purge all the cached nodes
  clear(): void;
}