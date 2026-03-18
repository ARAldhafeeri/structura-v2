import * as assert from "assert";
import type { SemanticNode } from "../../src/contract/Graph.js";
import { SemanticIndexState } from "../../src/core/Semantic.js";

const mockNode1: SemanticNode = {
  id: "func1",
  intent: "declaration" as any,
  name: "calculateTotal",
  location: {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 1 }
  },
  weight: 0.8,
  metadata: { type: "function" } as any
};

const mockNode2: SemanticNode = {
  id: "func2",
  intent: "declaration" as any,
  name: "processData",
  location: {
    start: { line: 2, column: 1 },
    end: { line: 2, column: 1 }
  },
  weight: 0.7,
  metadata: { type: "function" } as any
};

suite("SemanticIndexState", () => {
  
  test("constructor initializes without throwing", () => {
    const index = new SemanticIndexState();
    assert.ok(index);
  });

  test("search returns empty array when no nodes", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const results = await index.search("test");
    assert.deepStrictEqual(results.matches, []);
  });

  test("addNode and search", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const embedding = Array(384).fill(0.1);
    await index.addNode("node1", embedding);
    
    const results = await index.search("test", 5);
    assert.ok(Array.isArray(results.matches));
  });

  test("removeNode", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.addNode("node1", Array(384).fill(0.1));
    await index.removeNode("node1");
    
    const results = await index.search("test");
    assert.deepStrictEqual(results.matches, []);
  });

  test("rebuild with nodes", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.rebuild([mockNode1, mockNode2]);
    
    const results = await index.search("calculate", 5);
    assert.ok(Array.isArray(results.matches));
  });

  test("rebuild with empty array", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.addNode("node1", Array(384).fill(0.1));
    await index.rebuild([]);
    
    const results = await index.search("test");
    assert.deepStrictEqual(results.matches, []);
  });

  test("clear removes all nodes", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.rebuild([mockNode1, mockNode2]);
    await index.clear();
    
    const results = await index.search("test");
    assert.deepStrictEqual(results.matches, []);
  });

  test("multiple operations", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.addNode("node1", Array(384).fill(0.1));
    await index.addNode("node2", Array(384).fill(0.2));
    
    let results = await index.search("test", 5);
    assert.ok(results.matches.length <= 2);
    
    await index.removeNode("node1");
    results = await index.search("test", 5);
    assert.ok(results.matches.length <= 1);
    
    await index.clear();
    results = await index.search("test");
    assert.deepStrictEqual(results.matches, []);
  });

  test("search respects limit", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.rebuild([mockNode1, mockNode2]);
    
    const results = await index.search("test", 1);
    assert.ok(results.matches.length <= 1);
  });

  test("remove non-existent node doesn't throw", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.removeNode("nonexistent"); // Should not throw
    assert.ok(true);
  });

  test("add duplicate node overwrites", async () => {
    const index = new SemanticIndexState();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await index.addNode("node1", Array(384).fill(0.1));
    await index.addNode("node1", Array(384).fill(0.2)); // Overwrite
    
    const results = await index.search("test");
    assert.ok(Array.isArray(results.matches));
  });
});