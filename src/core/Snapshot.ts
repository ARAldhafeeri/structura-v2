import type { SemanticNode } from "../contract/Graph.js";
import type { ISnapshotNode, ISnapshotNodePointer, IStracturaSnapshotState } from "../contract/State/Snapshot.js";
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { GraphPanel } from "../graphPanel.js";

/**
 * Presisted in .structura/snapshots snapshot of user interactions with graphs
 * triggered at interval and maintain history of user snapshot
 * allow users for time travel functionality and possibly in the future
 */
export class SnapshotNode implements ISnapshotNode {
    constructor(public key: string, public snapshotPersistedFilePath: string, public prev: ISnapshotNodePointer, public next: ISnapshotNodePointer){
        this.key = key;
        this.snapshotPersistedFilePath = snapshotPersistedFilePath;
        this.prev = prev;
        this.next = next;
    }
}

export class SnapshotState implements IStracturaSnapshotState {
    private snapshotDir: string;
    
    constructor(public capacity: number, public head: ISnapshotNodePointer, public tail: ISnapshotNodePointer, public size: number){
        this.capacity = capacity;
        this.head = head;
        this.tail = tail;
        this.size = 0;
        this.snapshotDir = path.join(process.cwd(), '.structura', 'snapshots');
    }

    async getSnapshot(key: string): Promise<GraphPanel> {
        try {
        const filePath = this.get(key);
        const data = await fs.readFile(filePath as string);
        return JSON.parse(data as any)
        } catch {
          return {} as any;
        }
    }
    async persist(key: string, data: any): Promise<string> {
        // Ensure directory exists
        await fs.mkdir(this.snapshotDir, { recursive: true });
        
        // Generate UUID for snapshot
        const snapshotId = uuidv4();
        const filePath = path.join(this.snapshotDir, `${snapshotId}.json`);
        
        // Write snapshot data to file
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        
        // Add to in-memory linked list
        this.add(key, filePath);
        
        return filePath;
    }

    async unpersist(key: string): Promise<undefined> {
        const filePath = this.get(key);
        if (!filePath) {
            return undefined;
        }
        
        try {
            // Read and parse snapshot data
            const data = await fs.unlink(filePath);
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    async clear(): Promise<void> {
        // Clear in-memory linked list
        this.head = null;
        this.tail = null;
        this.size = 0;
        
        // Remove all snapshot files
        try {
            const files = await fs.readdir(this.snapshotDir);
            
            await Promise.all(
                files.map(file => fs.unlink(path.join(this.snapshotDir, file)))
            );
        } catch (error) {
            // Directory might not exist, ignore
        }
    }

    get(key: string): string | undefined {
        let curr = this.head;
        while(curr){
            if(curr.key === key){
                return curr.snapshotPersistedFilePath;
            }
            curr = curr.next;
        }
        return undefined;
    }

    add(key: string, value: string, ttl?: number): void {
        let node = new SnapshotNode(key, value, null, null);
        
        // First node
        if(!this.head){
            this.head = node;
            this.tail = node;
        } else {
            // Add to tail (most recent)
            if (this.tail) {
                this.tail.next = node;
                node.prev = this.tail;
                this.tail = node;
            }
        }
        
        this.size++;
        
        // Enforce capacity - remove from head (oldest)
        if (this.size > this.capacity) {
            if (this.head) {
                this.head = this.head.next;
                if (this.head) {
                    this.head.prev = null;
                }
                this.size--;
            }
        }
    }

    delete(key: string): void {
        let curr = this.head;
        while(curr) {
            if(curr.key === key) {
                // Remove from linked list
                if (curr.prev) {
                    curr.prev.next = curr.next;
                } else {
                    this.head = curr.next;
                }
                
                if (curr.next) {
                    curr.next.prev = curr.prev;
                } else {
                    this.tail = curr.prev;
                }
                
                this.size--;
                break;
            }
            curr = curr.next;
        }
    }
}