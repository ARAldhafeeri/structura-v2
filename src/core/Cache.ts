import type { SemanticNode } from "../contract/Graph.js";
import type { CacheStats, ICacheListNode, ICacheListNodePointer, ICacheState } from "../contract/State/Cache.js";

/**
 * Implementation of doubly linked list used in LRU class ICacheStateController
 */
export class CacheListNode implements ICacheListNode {
    constructor(public key: string, public value: SemanticNode, public prev: ICacheListNodePointer, public next: ICacheListNodePointer){}
}

/**
 * Implementation of cache state which is sized capacity LRU
 * This allow us to control the performance of stractura based
 * on machine capabilities especially memory, usually this should be set to low.
 * head maintain most accessed element, tail maintain least access
 * when capacity is full , tail is removed.
 * This should save parse operation, as well should be invalidated by 
 * file watching events. All synced through file path.
 */
export class CacheState implements ICacheState {
    private cache = new Map<string, ICacheListNode>();
    private misses: number = 0;
    private hits: number = 0;
    private stats: CacheStats = {
        hits: this.hits,
        misses: this.misses,
        lastUpdated: Date.now(),
        size: 0,

    }
    constructor(public capacity: number, public head: ICacheListNodePointer, public tail: ICacheListNodePointer ){};

    /**
     * Simply delete the current node and hook the previous
     * node to the current node to the next node to the current node
     * and wire the pointers.
     * @param node  LRU cache doubly linked list node
     */
    private _remove(node: CacheListNode) {
        if (!node) return;

        let prev = node.prev;
        let next = node.next;
        
        if (prev) prev.next = next;
        if (next) next.prev = prev;

        // edge case update head if we removing the head
        if (this.head = node){
            this.head = next;
        }

        // update tail if we are removing the tail
        if (this.tail == node){
            this.tail = prev;
        }

        // clear node pointers 
        node.prev = null;
        node.next = null;
    }

    /**
     * Add the node directly to the head ( most recently accessed)
     * most recently accessed is all operations including add
     * Here the current node will become head
     * and we wire the doubly linked list accordignly
     * @param node  LRU cache doubly linked list node
     */
    private _add(node: CacheListNode){
        // if list is empty, first added node.
        if(!this.head){
            this.head = node;
            this.tail = node;
            node.prev = null;
            node.next = null;
        } 

        // add to front
        node.next = this.head;
        node.prev = null;
        this.head.prev = node;
        this.head = node;

    }

    /**
     * Gets a node from cache, update the cache 
     * @param key - file path of parsed ats semantic node
     * @returns 
     */
    get(key: string): SemanticNode | undefined {
        this.stats.lastUpdated = Date.now();

        if(!this.cache.has(key)){
            this.misses += 1;
            return undefined
        }
        this.hits += 1;
        const  node = this.cache.get(key) as ICacheListNode;
        // only move to front when the node isn't at the front
        if (this.head !== node){
            this._remove(node);
            this._add(node);
        }
      
        return node.value;
    }

    set(key: string, value: SemanticNode, ttl?: number): void {
        // start set by removing the list node
        // to reorder the cache optimally
        if(this.cache.has(key)){
            this._remove(this.cache.get(key) as CacheListNode)
            this.cache.delete(key);
        }

        let newNode = new CacheListNode(key, value, null, null);

        this._add(newNode);
        this.cache.set(key, newNode);
        if (this.cache.size > this.capacity){
             let lru = this.tail;
             if (lru){
                // remove least freqently accessed element
                // when cache hit it size.
                this._remove(lru as CacheListNode );
                this.cache.delete(lru?.key as string)
             }
            
        }

    }

    has(key: string): boolean {
        const check = this.cache.has(key);
        this.stats.lastUpdated = Date.now();

        if (check){
            this.hits += 1;
        } else {
            this.misses += 1;
        }

        return check;
    }

    delete(key: string): void {
        this.stats.lastUpdated = Date.now();
        if (this.cache.has(key)){
            const node = this.cache.get(key) as CacheListNode;
            this._remove(node);
            this.cache.delete(key);
        }
        this.cache.delete(key);
    }

    getStats(): CacheStats {
        
        return {
           hits: this.hits,
           misses: this.misses, 
           lastUpdated: Date.now(),
           size: this.cache.size
        }
    }

    clear(): void {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.hits = 0
        this.misses = 0;
        this.stats.lastUpdated = Date.now();
    }
}