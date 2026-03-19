import type { IStracturaSnapshotState } from "./Snapshot.js";

/**
 * Simple way to keep track of user session while they
 * interact with stractura graph. 
 * Also a way to enable user to revisit sessions and name them
 * This is also can be for cool features like playbooks where users
 * record certain clicks and display them for others.
 */
export interface IStracturaSessionState {
  // generated session Id and the presisted per change stractura snapshot
  sessions: Map<string, IStracturaSnapshotState>;
  
  // Optional: Add metadata for each session
  metadata?: Map<string, SessionMetadata>;
}

export interface SessionMetadata {
  name?: string;
  createdAt: number;
  lastAccessed: number;
  description?: string;
  tags?: string[];
}

/**
 * Session management 
 */
export interface ISessionState {
  /**
   * state of session keeping simple initially should only
   * give the user the ability to time travel but also
   * extendable for future features.
   */
  state: IStracturaSessionState;

  /**
   * Set the session session id;
   * @param sessionId : The user current session id.
   */
  set(sessionId: string, history: IStracturaSnapshotState): void;
  
  /**
   * Get session by id
   * @param sessionId : The user current session id.
   */
  get(sessionId: string): IStracturaSnapshotState | undefined; // Return the snapshot, not the session map

  /**
   *  Delete single session 
   * @param sessionId The user current session id
   */
  delete(sessionId: string): void;
  
  /**
   * Purge the storage and call struacturaSnapshotState 
   * .clear method (not .delete)
   * Called when user click clean up button on the ui
   * This action is same as going to .sturactura folder 
   * and delete everything in snapshot but with handling
   * memory too.
   * @param sessionId The user current session Id
   */
  purge(sessionId: string): Promise<void>; // Should be async due to file operations
  
  /**
   * List all available sessions
   */
  list(): string[];
  
  /**
   * Rename a session
   */
  rename(sessionId: string, name: string): void;
}