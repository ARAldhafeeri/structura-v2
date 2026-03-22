import type { PriorityTask,  TaskCategory } from "./PriorityTaskQueue.js";
import type { IUserSettings } from "./UserSettings.js";
import * as vscode from 'vscode';
import type { IWebviewController } from "./ViewPort.js";
import type { IGraphState } from "./State/Graph.js";
import type { ICacheState } from "./State/Cache.js";
import type { ISemanticIndexState } from "./State/Semantic.js";
// import type { ISess } from "./State/Session.js";


/**
 * This file have TaskProcessor and TaskProcessorRegistry  contracts
 * . Stractura engine uses priority queue for core logic.
 * Each task will have a name which is defined in Priority Task Queue contract ./src/contract/PriorityTaskQueue.ts
 * As well each core building block within stractura will have a processor within ./src/processors
 * This allows for clean open for extension clossed for modification chain of resposbility implementation
 */

/**
 * Processing context optionally passed to every processor within stractura
 */
export interface IProcessorContext {
  graph: IGraphState;
  cache: ICacheState;
  session: any; // should be ISession
  semanticIndex: ISemanticIndexState;
  settings: IUserSettings;
  webview?: IWebviewController;
  editor: vscode.ExtensionContext;
}


/**
 * Task Processor Handler contract 
 */

export type  TaskProcessorHandler = (data: any, ctx?: IProcessorContext) => Promise<boolean>;

/**
 * Simple Task registry a map with setters and getters and validation.
 */
export type TaskRegistryMap = Map<string, TaskProcessorHandler>;

/**
 * TaskProcessorRegistry which is simple in-memory registry for task processors with methods such:
 * - add: ads task to registry with the processor.
 * - remove: removes a task type and it's processor from registry.
 * - get: gets task processor for the given type of task if it exists, if not, it will return null.
 * - clean: purge the entire registry.
 */
export interface ITaskProcessorRegistry {
    registry: TaskRegistryMap;
    add(task: PriorityTask,  processor: TaskProcessorHandler): void;
    remove(task: PriorityTask): void;
    get(task: PriorityTask): TaskProcessorHandler | undefined;
    clean(): void;
}

/**
 * TaskProcessor the main class which elegantly going to be injected into the priority task queue
 * to handle varity of tasks with single method:
 * - process : will get the type of the task and the associated PriorityTask data
 * as well it's designed to fail gracefully by returning a boolean of true or false.
 * true: means the processor reported successfuly processing
 * false: means the processor reported failure within it's scope
 * This allow for failure handling at multiple layer as well future logic of retries.
 *
 * ctx is injected at construction time and forwarded to every handler.
 * It is the ONLY sanctioned way for handlers to mutate graph/cache/session state —
 * nothing outside a handler should touch those objects directly.
 */
export interface ITaskProcessor {
    registry: ITaskProcessorRegistry;
    ctx?: IProcessorContext;
    process(task: PriorityTask): Promise<boolean>;
}
