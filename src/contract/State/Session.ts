import type { SemanticNode } from "../Graph.js";
import type { ViewportState } from "../ViewPort.js";

/**
 * User session transition and management methods of StracturaSessionState
 */
export interface IStracturaSessionState {
  activeFile: string;
  selectedNodes: SemanticNode[];
  viewPort: ViewportState;
}

/**
 * Session management 
 */
export interface ISessionState {
  state: IStracturaSessionState;

  // Current file
  getActiveFile(): string | null;
  setActiveFile(path: string | null): void;
  
  // Selection management
  getSelectedNodes(): string[];
  setSelectedNodes(nodeIds: string[]): void;
  toggleNodeSelection(nodeId: string): void;  // Suggested addition
  clearSelection(): void;  
  // Viewport
  getViewport(): ViewportState;
  setViewport(viewport: ViewportState): void;
  
  // History management - add types
  pushToHistory<T>(state: T): void;
  canUndo(): boolean;  
  canRedo(): boolean;  
  undo<T>(): T | undefined;
  redo<T>(): T | undefined;
  
  // History size limit?
  maxHistorySize?: number;
}
