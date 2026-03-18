import * as assert from "assert";
import { CacheState, CacheListNode } from "../../src/core/Cache.js";
import type { SemanticNode } from "../../src/contract/Graph.js";

const mockNode: SemanticNode = {
  id: "src/app.ts:42:5:FunctionDeclaration",
  intent: "declaration" as any,
  name: "calculateTotal",
  target: undefined,
  location: {
    start: {
        line: 42,
        column: 5,
    },
    end: {
        line: 42,
        column: 5,
    }
  },
  weight: 0.8,
  metadata: {
    type: "function",
    async: false,
    generator: false,
    nodeType: "1"
  },
  children: [
    {
      id: "src/app.ts:43:7:VariableDeclaration",
      intent: "declaration" as any,
      name: "subtotal",
      target: undefined,
      location: {
        start : {
             line: 43,
        column: 7
        },
        end: {
             line: 43,
        column: 7
        }
      },
      weight: 0.3,
      metadata: {
        type: "variable",
        dataType: "number",
        isConstant: false,
        nodeType: "",
      }
    }
  ],
  parentId: undefined
};

suite("Test LRU Doubly Linked List", () => {
  
    test("Positive simple three nodes check", () => {
        const node1 = new CacheListNode("1", mockNode, null, null);
        const node2 = new CacheListNode("2", mockNode, null, null);
        const node3 = new CacheListNode("3", mockNode, null, null);

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

suite("Test CacheState LRU Implementation", () => {
    
    test("Constructor initializes with correct capacity", () => {
        const cache = new CacheState(3, null, null);
        assert.strictEqual(cache.capacity, 3);
        assert.strictEqual(cache.head, null);
        assert.strictEqual(cache.tail, null);
    });

    test("Set and Get operations with single item", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        const result = cache.get("key1");
        
        assert.deepStrictEqual(result, mockNode);
        assert.strictEqual(cache.has("key1"), true);
    });

    test("Get returns undefined for non-existent key", () => {
        const cache = new CacheState(3, null, null);
        
        const result = cache.get("nonexistent");
        
        assert.strictEqual(result, undefined);
    });

    test("Has returns correct boolean and updates stats", () => {
        const cache = new CacheState(3, null, null);
        cache.set("key1", mockNode);
        
        assert.strictEqual(cache.has("key1"), true);
        assert.strictEqual(cache.has("nonexistent"), false);
        
        const stats = cache.getStats();
        assert.strictEqual(stats.hits, 1); // One hit from has("key1")
        assert.strictEqual(stats.misses, 1); // One miss from has("nonexistent")
    });

    test("LRU eviction when capacity exceeded", () => {
        const cache = new CacheState(2, null, null);
        
        cache.set("key1", mockNode);
        cache.set("key2", mockNode);
        cache.set("key3", mockNode); // This should evict key1 (least recently used)
        
        assert.strictEqual(cache.get("key1"), undefined);
        assert.deepStrictEqual(cache.get("key2"), mockNode);
        assert.deepStrictEqual(cache.get("key3"), mockNode);
    });

    test("Get operation updates LRU order", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.set("key2", mockNode);
        cache.set("key3", mockNode);
        
        // Access key1, making it most recent
        cache.get("key1");
        
        // Add new item, should evict key2 (least recently used)
        cache.set("key4", mockNode);
        
        assert.deepStrictEqual(cache.get("key1"), mockNode);
        assert.strictEqual(cache.get("key2"), undefined);
        assert.deepStrictEqual(cache.get("key3"), mockNode);
        assert.deepStrictEqual(cache.get("key4"), mockNode);
    });

    test("Set operation updates existing key and moves to front", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.set("key2", mockNode);
        cache.set("key3", mockNode);
        
        // Update key1, should move to front
        const updatedNode = { ...mockNode, name: "updated" };
        cache.set("key1", updatedNode);
        
        // Add new item, should evict key2
        cache.set("key4", mockNode);
        
        assert.deepStrictEqual(cache.get("key1"), updatedNode);
        assert.strictEqual(cache.get("key2"), undefined);
        assert.deepStrictEqual(cache.get("key3"), mockNode);
        assert.deepStrictEqual(cache.get("key4"), mockNode);
    });

    test("Delete operation removes key from cache", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.set("key2", mockNode);
        
        cache.delete("key1");
        
        assert.strictEqual(cache.get("key1"), undefined);
        assert.deepStrictEqual(cache.get("key2"), mockNode);
    });

    test("Clear operation empties cache", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.set("key2", mockNode);
        
        cache.clear();
        
        assert.strictEqual(cache.get("key1"), undefined);
        assert.strictEqual(cache.get("key2"), undefined);
        assert.strictEqual(cache.has("key1"), false);
    });

    test("GetStats returns correct statistics", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.get("key1"); // hit
        cache.get("key2"); // miss
        cache.has("key1"); // hit
        cache.has("key3"); // miss
        
        const stats = cache.getStats();
        
        assert.strictEqual(stats.hits, 2); // get hit + has hit
        assert.strictEqual(stats.misses, 2); // get miss + has miss
        assert.strictEqual(stats.size, 1); // size of cache
        assert.ok(stats.lastUpdated <= Date.now());
    });

    test("Edge case: Zero capacity cache", () => {
        const cache = new CacheState(0, null, null);
        
        cache.set("key1", mockNode);
        
        assert.strictEqual(cache.get("key1"), undefined);
        assert.strictEqual(cache.has("key1"), false);
    });

    test("Edge case: Negative capacity should still work", () => {
        const cache = new CacheState(-1, null, null);
        
        cache.set("key1", mockNode);
        
        // Should still work but never store anything
        assert.strictEqual(cache.get("key1"), undefined);
    });

    test("Edge case: Update non-existent key", () => {
        const cache = new CacheState(3, null, null);
        
        // This should work without errors
        cache.set("key1", mockNode);
        
        assert.deepStrictEqual(cache.get("key1"), mockNode);
    });

    test("Edge case: Delete non-existent key", () => {
        const cache = new CacheState(3, null, null);
        
        // This should not throw
        cache.delete("nonexistent");
    });

    test("Edge case: Get from empty cache", () => {
        const cache = new CacheState(3, null, null);
        
        assert.strictEqual(cache.get("anything"), undefined);
    });

    test("LRU order with multiple accesses", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.set("key2", mockNode);
        cache.set("key3", mockNode);
        
        // Access pattern: key2, key1, key3
        cache.get("key2");
        cache.get("key1");
        cache.get("key3");
        
        // Add new item, should evict key2 (least recently used)
        cache.set("key4", mockNode);
        
        assert.deepStrictEqual(cache.get("key1"), mockNode);
        assert.strictEqual(cache.get("key2"), undefined);
        assert.deepStrictEqual(cache.get("key3"), mockNode);
        assert.deepStrictEqual(cache.get("key4"), mockNode);
    });

    test("Stats persist through operations", () => {
        const cache = new CacheState(3, null, null);
        
        cache.set("key1", mockNode);
        cache.get("key1"); // hit
        cache.get("key2"); // miss
        
        const stats1 = cache.getStats();
        
        cache.get("key1"); // hit
        cache.get("key2"); // miss
        
        const stats2 = cache.getStats();
        
        assert.strictEqual(stats2.hits, stats1.hits + 1);
        assert.strictEqual(stats2.misses, stats1.misses + 1);
    });

    test("LastUpdated updates on cache operations", () => {
        const cache = new CacheState(3, null, null);
        
        const initialStats = cache.getStats();
        
        // Small delay to ensure timestamp difference
        setTimeout(() => {
            cache.set("key1", mockNode);
            const afterSetStats = cache.getStats();
            assert.ok(afterSetStats.lastUpdated > initialStats.lastUpdated);
            
            cache.get("key1");
            const afterGetStats = cache.getStats();
            assert.ok(afterGetStats.lastUpdated > afterSetStats.lastUpdated);
            
            cache.has("key1");
            const afterHasStats = cache.getStats();
            assert.ok(afterHasStats.lastUpdated > afterGetStats.lastUpdated);
        }, 10);
    });
});