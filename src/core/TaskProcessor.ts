import type { PriorityTask, TASK_NAME } from "../contract/PriorityTaskQueue.js";
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
    add(type: TASK_NAME, processor: TaskProcessorHandler): void {
        this.registry.set(type, processor);
    }

    /**
     * Removes single registry entry of task handlers
     * @param type 
     */
    remove(type: TASK_NAME): void {
        this.registry.delete(type);
    }

    /**
     * Gets task processor handler or null based on the provided type.
     * @param type 
     */
    get(type: TASK_NAME): TaskProcessorHandler | undefined {
        return this.registry.get(type);
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

    async process(type: TASK_NAME, data: PriorityTask): Promise<boolean> {
        const processor = this.registry.get(type);

        
        /**
         * There is no processor for given task type
         */
        if(!processor){
            console.warn(`${type} has no task processor registered!`)
            return false;
        };

        /**
         * Process the task
         */
        const output = await processor(data);

        // output failed return false to notify the next layer
        if(!output) {
            return false;
        }

        return true;
    }
}