import type { GraphData } from "../../graphGenerator.js";


/**
 * Doubly linked list to implement snapshotting controller.
 */
export type ISnapshotNodePointer = ISnapshotNode | null;

export interface ISnapshotNode {
  /**
   * SemanticNode.id
   */
  key: string;

  /**
   * presisted snapshot file path
   */
  snapshotPersistedFilePath: string;
  /**
   * Previous and Next snapshot node to the current one.
   */
  prev: ISnapshotNodePointer;
  next: ISnapshotNodePointer;
}

/**
 * Doubly linked list of fixed size history
 * where head  least recent snapshot history
 * tail is the most recent snapshot history
 * presist the state graph for set of time
 */
export interface IStracturaSnapshotState {
  // capacity is the maximum number of nodes
  capacity: number;
  // head is the least accessed snapshot past
  head: ISnapshotNode | null; 
  // which will be removed when cache size is hit.
  tail: ISnapshotNode | null;
  // keep track of size 
  size: number;
  // get single node with key
  get(key: string): string | undefined;
  // set single node with key
  add(key: string, value: string, ttl?: number): void;
  // delete single node by key
  delete(key: string): void;
  // purge all the cached nodes
  clear(): void;
  // remove snapshot file 
  unpersist(key: string): Promise<undefined>
  // persist snap shot to storge
  persist(key: string, data: any): Promise<string>
  // get a snapshot frome file system
  getSnapshot(key: string): Promise<GraphData>;
}