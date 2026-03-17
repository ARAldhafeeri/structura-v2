import type { PriorityTask,  TASK_NAME } from "./PriorityTaskQueue.js";

/**
 * This file have TaskProcessor and TaskProcessorRegistry  contracts
 * . Stractura engine uses priority queue for core logic.
 * Each task will have a name which is defined in Priority Task Queue contract ./src/contract/PriorityTaskQueue.ts
 * As well each core building block within stractura will have a processor within ./src/processors
 * This allows for clean open for extension clossed for modification chain of resposbility implementation
 */

/**
 * Task Processor Handler contract 
 */

export type  TaskProcessorHandler = (data: any) => Promise<boolean>;

/**
 * Simple Task registry a map with setters and getters and validation.
 */
export type TaskRegistryMap = Map<TASK_NAME, TaskProcessorHandler>;

/**
 * TaskProcessorRegistry which is simple in-memory registry for task processors with methods such:
 * - add: ads task to registry with the processor.
 * - remove: removes a task type and it's processor from registry.
 * - get: gets task processor for the given type of task if it exists, if not, it will return null.
 * - clean: purge the entire registry.
 */
export interface ITaskProcessorRegistry {
    registry: TaskRegistryMap;
    add(type: TASK_NAME, processor: TaskProcessorHandler): void;
    remove(type: TASK_NAME): void;
    get(type: TASK_NAME): TaskProcessorHandler | undefined;
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
 */
export interface ITaskProcessor {
    registry: ITaskProcessorRegistry;
    process(type: TASK_NAME, data: PriorityTask): Promise<boolean>;
}

