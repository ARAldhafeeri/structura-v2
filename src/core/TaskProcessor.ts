import { createTaskKeyForPriorityQueueHandlerRegistry, type PriorityTask, type TaskCategory } from "../contract/PriorityTaskQueue.js";
import type { ITaskProcessor, ITaskProcessorRegistry, TaskProcessorHandler, TaskRegistryMap } from "../contract/TaskProcessor.js";

export class TaskProcessorRegistry implements ITaskProcessorRegistry {

    /**
     * Intiate the registry with dependency injection for more testable code and more extendiblity.
     * @param registry 
     */
    constructor(public registry: TaskRegistryMap){
        this.registry = registry;
    }
    /**
     * Adds a task type and the processor handler to the registry map.
     * @param type - string donating the task type.
     * @param processor  - handler with specific contract for the task type.
     */
    add(task: PriorityTask, processor: TaskProcessorHandler): void {
        this.registry.set(createTaskKeyForPriorityQueueHandlerRegistry(task), processor);
    }

    /**
     * Removes single registry entry of task handlers
     * @param type 
     */
    remove(task: PriorityTask): void {
        this.registry.delete(createTaskKeyForPriorityQueueHandlerRegistry(task));
    }

    /**
     * Gets task processor handler or null based on the provided task.
     */
    get(task : PriorityTask): TaskProcessorHandler | undefined {
        return this.registry.get(createTaskKeyForPriorityQueueHandlerRegistry(task));
    }

    /**
     * Purge everything in the registry map.
     */
    clean(): void {
        this.registry.clear();
    }
}

export class TaskProcessor implements ITaskProcessor {
    constructor(public registry: TaskProcessorRegistry){
        this.registry = registry;
    }

    async process(task: PriorityTask): Promise<boolean> {
        const processor = this.registry.get(task);

        
        /**
         * There is no processor for given task type
         */
        if(!processor){
            console.warn(`${task.type, task.subType} has no task processor registered!`)
            return false;
        };

        /**
         * Process the task
         */
        const output = await processor(task);

        // output failed return false to notify the next layer
        if(!output) {
            return false;
        }

        return true;
    }
}