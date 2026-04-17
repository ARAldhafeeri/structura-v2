import type { Queue, Worker } from "bullmq";





/**
 * Piority Task Queue for managing asynchronous tasks within stractura engine.
 * The queue allows for prioritization of tasks based on their importance.
 * Since the graph construction is incremental and we are aiming to maximize 
 * the developer experience visually, we want to ensure
 * that anything related to the graph construction gets higher priority than other tasks.
 * priority levels:
 * 6000 - Graph construction and updates (highest priority)
 * 5000 - User interactions (e.g., clicks, hovers)
 * 4000 - Background processing (e.g., analytics, logging) (lowest priority)
 * 3000 - Maintaining local index of the source code for semantic search 
 * 2000 - Snapshotting the graph for time-travel debugging
 * 1000 - Any other tasks that are not critical to the immediate user experience
 * This is not final  and we can adjust as the engine evolves.
 * For better maintainabiity the tasks priority are of magnitude of a thousand 
 * This allow for composite priroity score with subTypePriority which is optional defaults to 0 
 * Below is the contract 
 * Note: sub tasks type + subType should be unique it's very important as it is used to fetch logic handlers
 * within core queue logic.
 */

// TASK SUBTYPES (kebab-case)
export type GraphConstructionSubType =
  | "initialize-graph"
  | "build-initial-graph"
  | "parse-file"
  | "expand-node"
  | "expand-node-importers"
  | "collapse-node"
  | "file-change"
  | "batch-process-files"
  | "build-full-graph";

export type UserInteractionSubType =
  | "node-click"
  | "node-double-click"
  | "node-hover"
  | "active-file-changed"
  | "toggle-graph"
  | "open-file-from-node"
  | "expand-selected-node"
  | "deselect-all-nodes"
  | "viewport-change"
  | "node-drag-drop"
  | "select-node"
  | "pin-node"
  | "hide-node";

export type StateManagementSubType = 
  | "save-state"
  | "load-state"
  | "create-snapshot"
  | "restore-snapshot"
  | "undo"
  | "redo"
  | "update-cache"
  | "clear-expired-cache"
  | "invalidate-cache";

export type LocalIndexingSubType = 
  | "build-semantic-index"
  | "update-node-index"
  | "remove-node-from-index"
  | "semantic-search"
  | "search-suggestions"
  | "clear-semantic-index";

export type BackgroundProcessingSubType = 
  | "garbage-collection"
  | "collect-analytics"
  | "session-logging"
  | "prefetch-files";

export type WebviewSubType = 
  | "send-graph-to-webview"
  | "highlight-nodes"
  | "update-layout";

export type SettingsSubType = 
  | "update-settings"
  | "load-settings";

// ============================================================================
// COMPREHENSIVE TASK SUBTYPE TYPE
// ============================================================================

export type TaskSubType = 
  | GraphConstructionSubType
  | UserInteractionSubType
  | StateManagementSubType
  | LocalIndexingSubType
  | BackgroundProcessingSubType
  | WebviewSubType
  | SettingsSubType;

// ============================================================================
// SUBTYPE CONSTANTS FOR TYPE-SAFE USAGE
// ============================================================================

export const GRAPH_CONSTRUCTION_SUBTYPES = {
  INITIALIZE_GRAPH: "initialize-graph",
  BUILD_INITIAL_GRAPH: "build-initial-graph",
  PARSE_FILE: "parse-file",
  EXPAND_NODE: "expand-node",
  EXPAND_NODE_IMPORTERS: "expand-node-importers",
  COLLAPSE_NODE: "collapse-node",
  FILE_CHANGE: "file-change",
  BATCH_PROCESS_FILES: "batch-process-files",
  BUILD_FULL_GRAPH: "build-full-graph"
} as const;

export const USER_INTERACTION_SUBTYPES = {
  NODE_CLICK: "node-click",
  NODE_DOUBLE_CLICK: "node-double-click",
  NODE_HOVER: "node-hover",
  ACTIVE_FILE_CHANGED: "active-file-changed",
  TOGGLE_GRAPH: "toggle-graph",
  OPEN_FILE_FROM_NODE: "open-file-from-node",
  EXPAND_SELECTED_NODE: "expand-selected-node",
  DESELECT_ALL_NODES: "deselect-all-nodes",
  VIEWPORT_CHANGE: "viewport-change",
  NODE_DRAG_DROP: "node-drag-drop",
  SELECT_NODE: "select-node",
  PIN_NODE: "pin-node",
  HIDE_NODE: "hide-node"
} as const;

export const STATE_MANAGEMENT_SUBTYPES = {
  SAVE_STATE: "save-state",
  LOAD_STATE: "load-state",
  CREATE_SNAPSHOT: "create-snapshot",
  RESTORE_SNAPSHOT: "restore-snapshot",
  UNDO: "undo",
  REDO: "redo",
  UPDATE_CACHE: "update-cache",
  CLEAR_EXPIRED_CACHE: "clear-expired-cache",
  INVALIDATE_CACHE: "invalidate-cache"
} as const;

export const LOCAL_INDEXING_SUBTYPES = {
  BUILD_SEMANTIC_INDEX: "build-semantic-index",
  UPDATE_NODE_INDEX: "update-node-index",
  REMOVE_NODE_FROM_INDEX: "remove-node-from-index",
  SEMANTIC_SEARCH: "semantic-search",
  SEARCH_SUGGESTIONS: "search-suggestions",
  CLEAR_SEMANTIC_INDEX: "clear-semantic-index"
} as const;

export const BACKGROUND_PROCESSING_SUBTYPES = {
  GARBAGE_COLLECTION: "garbage-collection",
  COLLECT_ANALYTICS: "collect-analytics",
  SESSION_LOGGING: "session-logging",
  PREFETCH_FILES: "prefetch-files"
} as const;

export const WEBVIEW_SUBTYPES = {
  SEND_GRAPH_TO_WEBVIEW: "send-graph-to-webview",
  HIGHLIGHT_NODES: "highlight-nodes",
  UPDATE_LAYOUT: "update-layout"
} as const;

export const SETTINGS_SUBTYPES = {
  UPDATE_SETTINGS: "update-settings",
  LOAD_SETTINGS: "load-settings"
} as const;

// SUBTYPE MAPPINGS FOR REGISTRY

export const SUBTYPE_TO_CATEGORY: Record<TaskSubType, TaskCategory> = {
  // Graph Construction
  "initialize-graph": "graph-construction",
  "build-initial-graph": "graph-construction",
  "parse-file": "graph-construction",
  "expand-node": "graph-construction",
  "expand-node-importers": "graph-construction",
  "collapse-node": "graph-construction",
  "file-change": "graph-construction",
  "batch-process-files": "graph-construction",
  "build-full-graph": "graph-construction",

  // User Interaction
  "node-click": "user-interaction",
  "node-double-click": "user-interaction",
  "node-hover": "user-interaction",
  "active-file-changed": "user-interaction",
  "toggle-graph": "user-interaction",
  "open-file-from-node": "user-interaction",
  "expand-selected-node": "user-interaction",
  "deselect-all-nodes": "user-interaction",
  "viewport-change": "user-interaction",
  "node-drag-drop": "user-interaction",
  "select-node": "user-interaction",
  "pin-node": "user-interaction",
  "hide-node": "user-interaction",
  
  // State Management
  "save-state": "snapshotting",
  "load-state": "snapshotting",
  "create-snapshot": "snapshotting",
  "restore-snapshot": "snapshotting",
  "undo": "snapshotting",
  "redo": "snapshotting",
  "update-cache": "snapshotting",
  "clear-expired-cache": "snapshotting",
  "invalidate-cache": "snapshotting",
  
  // Local Indexing
  "build-semantic-index": "local-indexing",
  "update-node-index": "local-indexing",
  "remove-node-from-index": "local-indexing",
  "semantic-search": "local-indexing",
  "search-suggestions": "local-indexing",
  "clear-semantic-index": "local-indexing",
  
  // Background Processing
  "garbage-collection": "background-processing",
  "collect-analytics": "background-processing",
  "session-logging": "background-processing",
  "prefetch-files": "background-processing",
  
  // Webview
  "send-graph-to-webview": "other",
  "highlight-nodes": "other",
  "update-layout": "other",
  
  // Settings
  "update-settings": "other",
  "load-settings": "other"
};

// DEFAULT SUBPRIORITIES FOR EACH SUBTYPE (0-99)

export const SUBTYPE_DEFAULT_PRIORITIES: Record<TaskSubType, number> = {
  // Graph Construction (High priority operations)
  "initialize-graph": 99,
  "build-initial-graph": 95,
  "parse-file": 90,
  "expand-node": 85,
  "expand-node-importers": 85,
  "collapse-node": 80,
  "file-change": 90,
  "batch-process-files": 70,
  "build-full-graph": 60,

  // User Interaction (Immediate feedback)
  "node-click": 99,
  "node-double-click": 98,
  "node-hover": 60, // Lower priority due to debouncing
  "active-file-changed": 85,
  "toggle-graph": 90,
  "open-file-from-node": 95,
  "expand-selected-node": 92,
  "deselect-all-nodes": 70,
  "viewport-change": 50, // Lower priority, can be throttled
  "node-drag-drop": 80,
  "select-node": 99,
  "pin-node": 95,
  "hide-node": 90,
  
  // State Management (Critical for data integrity)
  "save-state": 90,
  "load-state": 95,
  "create-snapshot": 80,
  "restore-snapshot": 95,
  "undo": 98,
  "redo": 98,
  "update-cache": 70,
  "clear-expired-cache": 40,
  "invalidate-cache": 60,
  
  // Local Indexing (Background but important)
  "build-semantic-index": 50,
  "update-node-index": 60,
  "remove-node-from-index": 50,
  "semantic-search": 80, // User-triggered search
  "search-suggestions": 70,
  "clear-semantic-index": 30,
  
  // Background Processing (Low priority)
  "garbage-collection": 20,
  "collect-analytics": 10,
  "session-logging": 5,
  "prefetch-files": 40,
  
  // Webview (UI updates)
  "send-graph-to-webview": 80,
  "highlight-nodes": 85,
  "update-layout": 70,
  
  // Settings
  "update-settings": 60,
  "load-settings": 70
};



export interface PriorityTask {
  id: string;
  type: string;
  subType: string; 
  data: any;
  priority: number; // composite score priority + subPriority 1-999 or 0
  subPriority: number; // 1-999
  description?: string;
  createdAt: number;
}

export interface WorkerStatus  {
    isProcessing: boolean;
    currentTask?: PriorityTask;
    queueLength: number;
  };
/**
 * Contract for the Priority Task Queue. 
 * This defines the methods that any implementation of the queue must have, 
 * such as adding tasks, processing tasks, clearing the queue, and retrieving pending 
 * tasks and worker status.
 * The PMQ will be built on top of bullmq.
 */
export interface IPriorityTaskQueue {
  addTask: (task: PriorityTask) => void;
  clearQueue: () => void;
  getWorker : () => Worker;
  getQueue : () => Queue;

}

export type TaskCategory = "graph-construction" | "user-interaction" | "background-processing" | "local-indexing" | "snapshotting" | "other";

type PRIORITY_LEVEL = 1000 | 2000 | 3000 | 4000 | 5000 | 6000;
type TaskPriorityMapping = Record<TaskCategory, PRIORITY_LEVEL>;

export const TASK_NAMES = {
  graphConstruction: "graph-construction",
  userInteraction: "user-interaction",
  backgroundProcessing: "background-processing",
  localIndexing: "local-indexing",
  snapshoting: "snapshoting",
  other: "other",
}
export const TASK_NAMES_WITH_PRIORITY : TaskPriorityMapping = {
  "graph-construction": 6000,
  "user-interaction": 5000,
  "background-processing": 4000,
  "local-indexing": 3000,
  "snapshotting": 2000,
  "other": 1000
}

export const TASK_NAMES_KEYS_SET = new Set(Object.keys(TASK_NAMES_WITH_PRIORITY))



export const createTask = <T extends TaskSubType>(
  subType: T,
  data?: any,
  subPriority?: number,
  description?: string
): PriorityTask => {
  const category = SUBTYPE_TO_CATEGORY[subType];
  const basePriority = TASK_NAMES_WITH_PRIORITY[category];
  const defaultSubPriority = SUBTYPE_DEFAULT_PRIORITIES[subType];
  const validSubPriority = subPriority ?? defaultSubPriority;
  
  // Ensure subPriority is within 0-99 range
  const clampedSubPriority = Math.min(99, Math.max(0, validSubPriority));
  
  return {
    id: `${category}:${subType}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
    type: category,
    subType,
    priority: basePriority + clampedSubPriority,
    subPriority: clampedSubPriority,
    description: description || `Process ${subType}`,
    data,
    createdAt: Date.now()
  };
};

// used to set and get handlers fo the task.
export const createTaskKeyForPriorityQueueHandlerRegistry = (task: PriorityTask) : string => {
  return `${task.type}-${task.subType}`;
}