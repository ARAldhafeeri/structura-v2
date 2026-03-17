import { Queue, Worker } from "bullmq";
import { TASK_NAMES_WITH_PRIORITY, type PriorityTask, type IPriorityTaskQueue, TASK_NAMES_KEYS_SET } from "../contract/PriorityTaskQueue.js";


/**
 * Validate queue name 
 */
const isQueueNameValid = (name:string) => {
    return TASK_NAMES_KEYS_SET.has(name);
}

/**
 * Simple implementation around bullq
 */
export class PriorityTaskQueue implements IPriorityTaskQueue {
    private queue: Queue;
    private worker: Worker;
    /**
     * Define the queue and the worker 
     * @param queueName queue name
     * @param processor 
     */
    constructor(queueName: string, processor: (job: PriorityTask) => Promise<void>, connection = { host: "localhost", port: 6379 }, deps = { QueueClass: Queue, WorkerClass: Worker }) {
        if (!isQueueNameValid(queueName)) {
            console.warn("Queue name is invalid")
        }
        // create queue and worker with dependency injection for easier testing .
        this.queue = new deps.QueueClass(queueName, { connection: connection });
        this.worker = new deps.WorkerClass(queueName, async (job) => {
        await processor(job.data);
        }, { connection: connection });


    }

    /**
     * Add task to the queue
     * @param task 
     */
    addTask(task : PriorityTask) {
        this.queue.add(task.id, task, {priority: task.priority});
    }


    /**
     * Clear queue
     */

    clearQueue() {
        this.queue.clean(200, 10)
    }

    /**
     * Get queue
     */
    getQueue() {
        return this.queue;
    }

    /**
     * Get Worker
     */
    getWorker() {
        return this.worker;
    }

}