import watcher, { type AsyncSubscription, type Event , } from "@parcel/watcher";

// file watcher 
type Watcher = typeof watcher;

// File subscription created upon subscribing  a file to be watched.
export interface FileSubscription {
    id: string;
    filePath: string;
    subscription: AsyncSubscription;
    unsubscribeCaller: () => Promise<void>;
}

/**
 * File watching subscription manager, manages the watched files in effecient, scalable way
 * operations : 
 * - add : add subscription.
 * - remove: remove subscription by id.
 * - get: get sbuscription by id
 * - getALl : get all subscriptions currently the program subscribed to watch
 * - findFilePath : get file path of the subscription.
 */
export class SubscriptionManager {
    /**
     * Keep track of subscriptions in-memory, for better performance and scalability, we can use a more efficient data structure like a trie or a prefix tree to manage file paths and their corresponding subscriptions, especially if we expect a large number of subscriptions with common prefixes.
     */
    private subscriptions: Map<string, FileSubscription> = new Map();
    
    /**
     * Add subscription to the manager
     * @param subscription file subscription
     */
    add(subscription: FileSubscription): void {
        this.subscriptions.set(subscription.id, subscription);
    }
    
    /**
     * Remove single subscription by id, this method returns the removed subscription 
     * if it exists, otherwise it returns undefined. 
     * This allows the caller to perform any necessary cleanup or logging after a 
     * subscription is removed.
     * @param id  string identifier of the subscription
     * @returns 
     */
    remove(id: string): FileSubscription | undefined {
        const sub = this.subscriptions.get(id);
        this.subscriptions.delete(id);
        return sub;
    }
    
    /**
     * Get single subscription for a given id,
     *  this method returns the subscription if it exists, 
     * otherwise it returns undefined.
     * @param id identifier of the subscription
     * @returns 
     */
    get(id: string): FileSubscription | undefined {
        return this.subscriptions.get(id);
    }
    
    /**
     * Get all subscriptions currently being watched, this method returns an array of all
     * @returns subscriptions
     */
    findAll(): FileSubscription[] {
        return Array.from(this.subscriptions.values());
    }
    
    /**
     * Find subscriptions by file path, 
     * this method returns an array of subscriptions that match the given file path.
     * @param filePath file absoulte path
     * @returns 
     */
    findByFilePath(filePath: string): FileSubscription[] {
        return this.findAll().filter(sub => sub.filePath === filePath);
    }
}

/**
 * File watcher handler type, 
 * this type defines the signature of the handler function that will be called 
 * when a file change event occurs. 
 * The handler receives an array of events and an error object (if any) as parameters. 
 * This allows for a flexible and extensible way to handle file change events, 
 * as different handlers can be registered to perform various actions based on the events received.
 */
export type FileWatcherHandler = ( err: Error | null, events: Event[]) => void;

/**
 * File Watcher Handlers Registry,
 * this class manages the registration and retrieval of file watcher handlers.
 * It provides methods to add, delete, find single handler by id, find all handlers, and flush all handlers.
 * By default the file watcher support multiple handlers, for every file all handlers will be called.
 * This allows for a modular and extensible design, where different components can register their own handlers 
 * to respond to file change events without interfering with each other.
 * 
 * The core idea behind this design is to decouple the file watching logic from the event handling.
 * As well since the use-case is to notify other components of changes and update the graph.
 * Then most likely there will be few handlers that are registered to handle the events.
 * Subscribing and flushing handlers should not be a frequent operations.
 */

export class HandlersRegisry {
    /**
     * In-memory handlers registry uses a Map to store handlers with unique identifiers, 
     * allowing for efficient addition, deletion, and retrieval of handlers.
     */
    public handlers : Map<string, FileWatcherHandler> = new Map();

    /**
     * Register a new handler 
     */
    add(handler: FileWatcherHandler) {
        this.handlers.set(crypto.randomUUID(), handler);
    }  

    /**
     * Unregister a handler
     */
    delete(id: string){
        this.handlers.delete(id);
    }

    /**
     * find single handler.
     */
    findOne(id: string){
        return this.handlers.get(id);
    }

    /**
     * Get all registered handlers.
     */

    findAll() {
        return this.handlers.values();
    }

    /**
     * Flush all registered handlers
     */
    flush() {
        this.handlers.clear()
    }

}

/**
 * Subscribe for changes in files that are present in the graph to notify
 * other components of change so the graph gets updated.
 */

export class GraphFileWatcher {
    private subscriptionManager = new SubscriptionManager();
    constructor(
        private watcher: Watcher,
        private options = { concurrency: 5 },
        private handlerRegistry : HandlersRegisry
    ) {}
    
    /**
     * Subscribe to watch a single file, this method returns the subscription id that can be used to unsubscribe later.
     * @param files array of strings of file paths
     * @returns subscription ids as an array of strings
     */
    async watchMany(files: string[]): Promise<string[]> {
        const tasks = files.map(async (file) => {
            const subscription = await this.watcher.subscribe(file, (err, events) => {
                for (const handler of this.handlerRegistry.findAll()){
                    handler(err, events)
                }
            });
            const id = crypto.randomUUID();
            
            this.subscriptionManager.add({
                id,
                filePath: file,
                subscription,
                unsubscribeCaller: subscription.unsubscribe.bind(subscription)
            });
            
            return id;
        });
        
        return Promise.all(tasks);
    }
    
    /**
     * Unsubscribe from a single file subscription.
     * @param id subscription identifier 
     */
    async unsubscribeOne(id: string): Promise<void> {
        const subscription = this.subscriptionManager.remove(id);
        if (subscription) {
            await subscription.unsubscribeCaller();
        }
    }
    
    /**
     * unsubscripe from multiple file subscriptions.
     * @param ids array of subscription identifiers
     */
    async unsubscribeMany(ids: string[]): Promise<void> {
        const batches = [];
        for (let i = 0; i < ids.length; i += this.options.concurrency) {
            batches.push(ids.slice(i, i + this.options.concurrency));
        }
        
        for (const batch of batches) {
            await Promise.all(batch.map(id => this.unsubscribeOne(id)));
        }
    }
    
    /**
     * Flush all subscriptions, this method unsubscribes 
     * from all currently active subscriptions and clears the subscription manager.
     */
    async flushAllSubscriptions(): Promise<void> {
        const allSubs = this.subscriptionManager.findAll();
        await this.unsubscribeMany(allSubs.map(sub => sub.id));
    }
    
}