import * as assert from "assert";
import { SnapshotState, SnapshotNode } from "../../src/core/Snapshot.js";
import fs from 'fs/promises';
import path from 'path';

const mockData = {
  graph: {
    nodes: [
      {
        id: "src/app.ts:42:5:FunctionDeclaration",
        intent: "declaration",
        name: "calculateTotal",
        location: {
          start: { line: 42, column: 5 },
          end: { line: 42, column: 5 }
        }
      }
    ]
  },
  timestamp: Date.now()
};

suite("Test Snapshot Doubly Linked List", () => {
  
    test("Positive simple three nodes check", () => {
        const node1 = new SnapshotNode("snap1", "/path/to/1.json", null, null);
        const node2 = new SnapshotNode("snap2", "/path/to/2.json", null, null);
        const node3 = new SnapshotNode("snap3", "/path/to/3.json", null, null);

        // construct doubly linked list 
        node1.next = node2;
        node2.prev = node1;
        node2.next = node3;
        node3.prev = node2;

        assert.strictEqual(node1.next, node2);
        assert.strictEqual(node2.next, node3);
        assert.strictEqual(node3.prev, node2);
        assert.strictEqual(node2.prev, node1);
    });
});

suite("Test SnapshotState Implementation", () => {
    const testDir = path.join(process.cwd(), '.structura', 'snapshots');
    
    test("Constructor initializes with correct capacity", () => {
        const snapshot = new SnapshotState(5, null, null, 0);
        
        assert.strictEqual(snapshot.capacity, 5);
        assert.strictEqual(snapshot.head, null);
        assert.strictEqual(snapshot.tail, null);
        assert.strictEqual(snapshot.size, 0);
    });

    test("Add and Get operations with single item", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        snapshot.add("snap1", "/path/to/snap1.json");
        const result = snapshot.get("snap1");
        
        assert.strictEqual(result, "/path/to/snap1.json");
    });

    test("Get returns undefined for non-existent key", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        const result = snapshot.get("nonexistent");
        
        assert.strictEqual(result, undefined);
    });

    test("Add maintains correct order (head oldest, tail newest)", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        snapshot.add("snap2", "/path/to/2.json");
        snapshot.add("snap3", "/path/to/3.json");
        
        assert.strictEqual(snapshot.head?.key, "snap1");
        assert.strictEqual(snapshot.tail?.key, "snap3");
        assert.strictEqual(snapshot.head?.next?.key, "snap2");
        assert.strictEqual(snapshot.tail?.prev?.key, "snap2");
        assert.strictEqual(snapshot.size, 3);
    });

    test("Add enforces capacity by removing oldest (head)", () => {
        const snapshot = new SnapshotState(2, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        snapshot.add("snap2", "/path/to/2.json");
        snapshot.add("snap3", "/path/to/3.json"); // This should evict snap1
        
        assert.strictEqual(snapshot.get("snap1"), undefined);
        assert.strictEqual(snapshot.get("snap2"), "/path/to/2.json");
        assert.strictEqual(snapshot.get("snap3"), "/path/to/3.json");
        assert.strictEqual(snapshot.size, 2);
        assert.strictEqual(snapshot.head?.key, "snap2");
        assert.strictEqual(snapshot.tail?.key, "snap3");
    });

    test("Delete removes node and updates links", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        snapshot.add("snap2", "/path/to/2.json");
        snapshot.add("snap3", "/path/to/3.json");
        
        snapshot.delete("snap2");
        
        assert.strictEqual(snapshot.get("snap2"), undefined);
        assert.strictEqual(snapshot.size, 2);
        assert.strictEqual(snapshot.head?.next?.key, "snap3");
        assert.strictEqual(snapshot.tail?.prev?.key, "snap1");
    });

    test("Delete head node updates head correctly", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        snapshot.add("snap2", "/path/to/2.json");
        
        snapshot.delete("snap1");
        
        assert.strictEqual(snapshot.head?.key, "snap2");
        assert.strictEqual(snapshot.head?.prev, null);
        assert.strictEqual(snapshot.size, 1);
    });

    test("Delete tail node updates tail correctly", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        snapshot.add("snap2", "/path/to/2.json");
        
        snapshot.delete("snap2");
        
        assert.strictEqual(snapshot.tail?.key, "snap1");
        assert.strictEqual(snapshot.tail?.next, null);
        assert.strictEqual(snapshot.size, 1);
    });

    test("Persist creates file with UUID in correct directory", async () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        // Clean up before test
        await snapshot.clear();
        
        const filePath = await snapshot.persist("test-snap", mockData);
        
        // Check file exists
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        assert.strictEqual(exists, true);
        
        // Check file is in correct directory
        assert.ok(filePath.includes('.structura') && filePath.includes("snapshots"));
        assert.ok(filePath.endsWith('.json'));
        
        // Check content
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        assert.deepStrictEqual(parsed, mockData);
        
        // Check in-memory state
        assert.strictEqual(snapshot.get("test-snap"), filePath);
        assert.strictEqual(snapshot.size, 1);
        
        // Clean up
        await snapshot.clear();
    });

    test("Persist respects capacity limit", async () => {
        const snapshot = new SnapshotState(2, null, null, 0);
        
        await snapshot.clear();
        
        await snapshot.persist("snap1", mockData);
        await snapshot.persist("snap2", mockData);
        const filePath3 = await snapshot.persist("snap3", mockData);
        
        // snap1 should be evicted
        assert.strictEqual(snapshot.get("snap1"), undefined);
        assert.ok(snapshot.get("snap2"));
        assert.ok(snapshot.get("snap3"));
        assert.strictEqual(snapshot.size, 2);
        
        // Clean up
        await snapshot.clear();
    });

    test("Unpersist removes data correctly", async () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        await snapshot.clear();
        
        await snapshot.persist("test-snap", mockData);
        const retrieved = await snapshot.unpersist("test-snap");
        
        assert.strictEqual(retrieved, undefined);
        
        // Clean up
        await snapshot.clear();
    });

    test("getSnapshot retrieve data correctly", async () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        await snapshot.clear();
        
        await snapshot.persist("test-snap", mockData);
        const retrieved = await snapshot.getSnapshot("test-snap");
        
        assert.deepStrictEqual(retrieved, mockData);
        
        // Clean up
        await snapshot.clear();
    });

    test("Unpersist returns undefined for non-existent key", async () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        const result = await snapshot.unpersist("nonexistent");
        
        assert.strictEqual(result, undefined);
    });

    test("Clear removes all in-memory nodes and files", async () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        await snapshot.clear();
        
        await snapshot.persist("snap1", mockData);
        await snapshot.persist("snap2", mockData);
        
        await snapshot.clear();
        
        // Check in-memory state
        assert.strictEqual(snapshot.head, null);
        assert.strictEqual(snapshot.tail, null);
        assert.strictEqual(snapshot.size, 0);
        
        // // Check files are deleted
        const files = await fs.readdir(testDir).catch(() => []);
        console.log("SNAP", testDir, files.length)

        assert.strictEqual(files.length, 0);
    });

    test("Edge case: Delete non-existent key", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        // This should not throw
        snapshot.delete("nonexistent");
    });

    test("Edge case: Get from empty snapshot", () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        assert.strictEqual(snapshot.get("anything"), undefined);
    });

    test("Edge case: Zero capacity snapshot", () => {
        const snapshot = new SnapshotState(0, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        
        assert.strictEqual(snapshot.get("snap1"), undefined);
        assert.strictEqual(snapshot.size, 0);
    });

    test("Multiple snapshots maintain correct order", () => {
        const snapshot = new SnapshotState(5, null, null, 0);
        
        snapshot.add("snap1", "/path/to/1.json");
        snapshot.add("snap2", "/path/to/2.json");
        snapshot.add("snap3", "/path/to/3.json");
        snapshot.add("snap4", "/path/to/4.json");
        
        assert.strictEqual(snapshot.head?.key, "snap1");
        assert.strictEqual(snapshot.head?.next?.key, "snap2");
        assert.strictEqual(snapshot.head?.next?.next?.key, "snap3");
        assert.strictEqual(snapshot.tail?.key, "snap4");
        assert.strictEqual(snapshot.tail?.prev?.key, "snap3");
    });

    test("Persist generates unique UUIDs for each snapshot", async () => {
        const snapshot = new SnapshotState(3, null, null, 0);
        
        await snapshot.clear();
        
        const filePath1 = await snapshot.persist("snap1", mockData);
        const filePath2 = await snapshot.persist("snap2", mockData);
        
        assert.notStrictEqual(filePath1, filePath2);
        
        // Clean up
        await snapshot.clear();
    });
});