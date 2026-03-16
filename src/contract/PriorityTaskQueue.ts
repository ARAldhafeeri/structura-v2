import type { Queue, Worker } from "bullmq";





/**
 * Piority Task Queue for managing asynchronous tasks within stractura engine.
 * The queue allows for prioritization of tasks based on their importance.
 * Since the graph construction is incremental and we are aiming to maximize 
 * the developer experience visually, we want to ensure
 * that anything related to the graph construction gets higher priority than other tasks.
 * priority levels:
 * 60 - Graph construction and updates (highest priority)
 * 50 - User interactions (e.g., clicks, hovers)
 * 40 - Background processing (e.g., analytics, logging) (lowest priority)
 * 30 - Maintaining local index of the source code for semantic search 
 * 20- Snapshotting the graph for time-travel debugging
 * 10- Any other tasks that are not critical to the immediate user experience
 * This is not final  and we can adjust as the engine evolves. 
 * Below is the contract 
 */
export interface PriorityTask {
  id: string;
  task: () => Promise<void>;
  type: string;
  priority: number;
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

type TASK_NAME = "graph-construction" | "user-interaction" | "background-processing" | "local-indexing" | "snapshotting" | "other";
type PRIORITY_LEVEL = 10 | 20 | 30 | 40 | 50 | 60;
type TaskPriorityMapping = Record<TASK_NAME, PRIORITY_LEVEL>;

export const TASK_NAMES = {
  graphConstruction: "graph-construction",
  userInteraction: "user-interaction",
  backgroundProcessing: "background-processing",
  localIndexing: "local-indexing",
  snapshoting: "snapshoting",
  other: "other",
}
export const TASK_NAMES_WITH_PRIORITY : TaskPriorityMapping = {
  "graph-construction": 60,
  "user-interaction": 50,
  "background-processing": 40,
  "local-indexing": 30,
  "snapshotting": 20,
  "other": 10
}


const getGraphConstructionTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  task,
  type: TASK_NAMES.graphConstruction,
  priority: TASK_NAMES_WITH_PRIORITY["graph-construction"],
  description,
  createdAt: Date.now()
});

const getUserInteractionTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  task,
  type: TASK_NAMES.userInteraction,
  priority: TASK_NAMES_WITH_PRIORITY["user-interaction"],
  description,
  createdAt: Date.now()
});

const getBackgroundProcessingTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  task,
  type: TASK_NAMES.backgroundProcessing,
  priority: TASK_NAMES_WITH_PRIORITY["background-processing"],
  description,
  createdAt: Date.now()
});

const getLocalIndexingTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  type: TASK_NAMES.localIndexing,
  task,
  priority: TASK_NAMES_WITH_PRIORITY["local-indexing"],
  description,
  createdAt: Date.now(),
});

const getSnapshottingTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  type: TASK_NAMES.snapshoting,
  task,
  priority: TASK_NAMES_WITH_PRIORITY["snapshotting"],
  description,
  createdAt: Date.now(),
});

const getOtherTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  type: TASK_NAMES.other,
  task,
  priority: TASK_NAMES_WITH_PRIORITY["other"],
  description, 
  createdAt: Date.now()
});

// all tasks getter 
export const StracturaQueueTasks = {
  getGraphConstructionTask,
  getUserInteractionTask,
  getBackgroundProcessingTask,
  getLocalIndexingTask,
  getSnapshottingTask,
  getOtherTask
}