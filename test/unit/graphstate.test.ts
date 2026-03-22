import * as assert from "assert";
import { GraphState } from "../../src/core/GraphState.js";
import type { GraphChangeEvent } from "../../src/core/GraphState.js";
import type { SemanticNode, SemanticEdge, ExpansionPolicy } from "../../src/contract/Graph.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeNode = (id: string, weight = 1.0): SemanticNode => ({
  id,
  intent: "definition",
  name: id,
  location: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
  weight,
  metadata: { nodeType: "FunctionDeclaration" },
});

const makeEdge = (from: string, to: string, weight = 1.0): SemanticEdge => ({ from, to, weight });

const defaultPolicy: ExpansionPolicy = {
  order: [],
  maxDepth: 3,
  maxNodesPerLevel: 100,
  fanOutLimit: 100,
  weightThreshold: 0,
  stopOnCycles: true,
  includeExternal: true,
};

// ── Node operations ──────────────────────────────────────────────────────────

suite("GraphState — node operations", () => {
  test("addNode stores and retrieves a node", () => {
    const gs = new GraphState();
    const node = makeNode("a");
    gs.addNode(node);
    assert.deepStrictEqual(gs.getNode("a"), node);
  });

  test("getNode returns undefined for unknown id", () => {
    const gs = new GraphState();
    assert.strictEqual(gs.getNode("nope"), undefined);
  });

  test("addNodes batch-adds and all are retrievable", () => {
    const gs = new GraphState();
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    gs.addNodes(nodes);
    assert.strictEqual(gs.getAllNodes().length, 3);
    assert.deepStrictEqual(gs.getNodes(["a", "c"]), [makeNode("a"), makeNode("c")]);
  });

  test("getNodes skips missing ids", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("a"));
    assert.deepStrictEqual(gs.getNodes(["a", "missing"]), [makeNode("a")]);
  });

  test("updateNode merges partial updates", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("a", 0.5));
    gs.updateNode("a", { weight: 0.9 });
    assert.strictEqual(gs.getNode("a")!.weight, 0.9);
    assert.strictEqual(gs.getNode("a")!.name, "a");
  });

  test("updateNode on unknown id is a no-op", () => {
    const gs = new GraphState();
    assert.doesNotThrow(() => gs.updateNode("ghost", { weight: 99 }));
  });

  test("updateNodes batch-updates all provided ids", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("a", 1), makeNode("b", 1)]);
    const updates = new Map<string, Partial<SemanticNode>>([
      ["a", { weight: 5 }],
      ["b", { weight: 7 }],
    ]);
    gs.updateNodes(updates);
    assert.strictEqual(gs.getNode("a")!.weight, 5);
    assert.strictEqual(gs.getNode("b")!.weight, 7);
  });

  test("removeNode removes the node", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("a"));
    gs.removeNode("a");
    assert.strictEqual(gs.getNode("a"), undefined);
  });

  test("removeNode on unknown id is a no-op", () => {
    const gs = new GraphState();
    assert.doesNotThrow(() => gs.removeNode("ghost"));
  });

  test("removeNode also removes connected edges", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("a"), makeNode("b")]);
    gs.addEdge(makeEdge("a", "b"));
    gs.removeNode("a");
    assert.strictEqual(gs.getEdges("a").length, 0);
    assert.strictEqual(gs.getEdges(undefined, "b").length, 0);
  });

  test("removeNodes removes only existing ids", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("a"), makeNode("b")]);
    gs.removeNodes(["a", "ghost"]);
    assert.strictEqual(gs.getNode("a"), undefined);
    assert.ok(gs.getNode("b"));
  });

  test("state getter reflects current nodes", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("a"));
    assert.strictEqual(gs.state.nodes.length, 1);
  });
});

// ── Edge operations ──────────────────────────────────────────────────────────

suite("GraphState — edge operations", () => {
  test("addEdge stores edge and is retrievable", () => {
    const gs = new GraphState();
    const edge = makeEdge("a", "b");
    gs.addEdge(edge);
    assert.deepStrictEqual(gs.getEdgesBetween("a", "b"), [edge]);
  });

  test("getEdges with fromId returns outgoing edges", () => {
    const gs = new GraphState();
    gs.addEdges([makeEdge("a", "b"), makeEdge("a", "c"), makeEdge("x", "b")]);
    const out = gs.getEdges("a");
    assert.strictEqual(out.length, 2);
    assert.ok(out.every((e) => e.from === "a"));
  });

  test("getEdges with toId returns incoming edges", () => {
    const gs = new GraphState();
    gs.addEdges([makeEdge("a", "b"), makeEdge("c", "b")]);
    const incoming = gs.getEdges(undefined, "b");
    assert.strictEqual(incoming.length, 2);
    assert.ok(incoming.every((e) => e.to === "b"));
  });

  test("getEdges with no filter returns all edges", () => {
    const gs = new GraphState();
    gs.addEdges([makeEdge("a", "b"), makeEdge("b", "c")]);
    assert.strictEqual(gs.getEdges().length, 2);
  });

  test("getEdgesBetween returns empty array when no edge exists", () => {
    const gs = new GraphState();
    assert.deepStrictEqual(gs.getEdgesBetween("x", "y"), []);
  });

  test("addEdges batch-adds all edges", () => {
    const gs = new GraphState();
    gs.addEdges([makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")]);
    assert.strictEqual(gs.getEdges().length, 3);
  });

  test("removeEdge deletes the specific edge", () => {
    const gs = new GraphState();
    gs.addEdge(makeEdge("a", "b"));
    gs.removeEdge("a", "b");
    assert.deepStrictEqual(gs.getEdgesBetween("a", "b"), []);
  });

  test("removeEdge on non-existent edge is a no-op", () => {
    const gs = new GraphState();
    assert.doesNotThrow(() => gs.removeEdge("x", "y"));
  });

  test("removeEdges removes only existing edges", () => {
    const gs = new GraphState();
    gs.addEdge(makeEdge("a", "b"));
    gs.removeEdges([{ fromId: "a", toId: "b" }, { fromId: "x", toId: "y" }]);
    assert.strictEqual(gs.getEdges().length, 0);
  });

  test("adding edge between non-existent nodes still works", () => {
    const gs = new GraphState();
    gs.addEdge(makeEdge("ghost1", "ghost2"));
    assert.strictEqual(gs.getEdges("ghost1").length, 1);
  });
});

// ── Change events ─────────────────────────────────────────────────────────────

suite("GraphState — change events", () => {
  test("addNode emits nodes-added event", () => {
    const gs = new GraphState();
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.addNode(makeNode("a"));
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, "nodes-added");
    assert.deepStrictEqual(events[0].payload!.nodes![0], makeNode("a"));
  });

  test("removeNode emits nodes-removed event", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("a"));
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.removeNode("a");
    assert.strictEqual(events[0].type, "nodes-removed");
    assert.deepStrictEqual(events[0].payload!.nodeIds, ["a"]);
  });

  test("addEdge emits edges-added event", () => {
    const gs = new GraphState();
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.addEdge(makeEdge("a", "b"));
    assert.strictEqual(events[0].type, "edges-added");
  });

  test("removeEdge emits edges-removed event", () => {
    const gs = new GraphState();
    gs.addEdge(makeEdge("a", "b"));
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.removeEdge("a", "b");
    assert.strictEqual(events[0].type, "edges-removed");
    assert.deepStrictEqual(events[0].payload!.removedEdges, [{ fromId: "a", toId: "b" }]);
  });

  test("clear emits cleared event", () => {
    const gs = new GraphState();
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.clear();
    assert.strictEqual(events[0].type, "cleared");
  });

  test("unsubscribe stops listener from receiving events", () => {
    const gs = new GraphState();
    const events: GraphChangeEvent[] = [];
    const unsub = gs.subscribe((e) => events.push(e));
    unsub();
    gs.addNode(makeNode("a"));
    assert.strictEqual(events.length, 0);
  });

  test("multiple listeners all receive events", () => {
    const gs = new GraphState();
    const a: GraphChangeEvent[] = [];
    const b: GraphChangeEvent[] = [];
    gs.subscribe((e) => a.push(e));
    gs.subscribe((e) => b.push(e));
    gs.addNode(makeNode("x"));
    assert.strictEqual(a.length, 1);
    assert.strictEqual(b.length, 1);
  });
});

// ── expandNode ─────────────────────────────────────────────────────────────

suite("GraphState — expandNode", () => {
  /**
   * Graph:  seed → a → b → c
   */
  const buildChain = () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("seed", 5), makeNode("a", 4), makeNode("b", 3), makeNode("c", 2)]);
    gs.addEdges([makeEdge("seed", "a"), makeEdge("a", "b"), makeEdge("b", "c")]);
    return gs;
  };

  test("returns direct children at depth 1", () => {
    const gs = buildChain();
    const result = gs.expandNode((n) => n.id === "seed", { ...defaultPolicy, maxDepth: 1 });
    assert.deepStrictEqual(result.map((n) => n.id), ["a"]);
  });

  test("returns transitive children up to maxDepth", () => {
    const gs = buildChain();
    const result = gs.expandNode((n) => n.id === "seed", { ...defaultPolicy, maxDepth: 3 });
    assert.deepStrictEqual(result.map((n) => n.id), ["a", "b", "c"]);
  });

  test("respects maxNodesPerLevel cap", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("seed", 5));
    for (let i = 0; i < 5; i++) {
      gs.addNode(makeNode(`child${i}`, 1));
      gs.addEdge(makeEdge("seed", `child${i}`));
    }
    const result = gs.expandNode((n) => n.id === "seed", { ...defaultPolicy, maxNodesPerLevel: 2 });
    assert.strictEqual(result.length, 2);
  });

  test("respects fanOutLimit per source node", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("seed", 5));
    for (let i = 0; i < 5; i++) {
      gs.addNode(makeNode(`child${i}`, 1));
      gs.addEdge(makeEdge("seed", `child${i}`));
    }
    const result = gs.expandNode((n) => n.id === "seed", { ...defaultPolicy, fanOutLimit: 2 });
    assert.strictEqual(result.length, 2);
  });

  test("respects weightThreshold — skips low-weight nodes", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("seed", 5), makeNode("heavy", 3), makeNode("light", 0.1)]);
    gs.addEdges([makeEdge("seed", "heavy"), makeEdge("seed", "light")]);
    const result = gs.expandNode((n) => n.id === "seed", { ...defaultPolicy, weightThreshold: 1 });
    assert.deepStrictEqual(result.map((n) => n.id), ["heavy"]);
  });

  test("stopOnCycles prevents revisiting nodes", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("a", 5), makeNode("b", 4)]);
    gs.addEdges([makeEdge("a", "b"), makeEdge("b", "a")]);
    const result = gs.expandNode((n) => n.id === "a", { ...defaultPolicy, stopOnCycles: true });
    assert.deepStrictEqual(result.map((n) => n.id), ["b"]);
  });

  test("returns empty array when predicate matches nothing", () => {
    const gs = buildChain();
    const result = gs.expandNode((n) => n.id === "nonexistent", defaultPolicy);
    assert.deepStrictEqual(result, []);
  });

  test("prefers higher-weight nodes when sorting without order", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("seed", 5));
    gs.addNode(makeNode("low", 0.5));
    gs.addNode(makeNode("high", 4));
    gs.addEdges([makeEdge("seed", "low"), makeEdge("seed", "high")]);
    const result = gs.expandNode((n) => n.id === "seed", { ...defaultPolicy, fanOutLimit: 1 });
    assert.strictEqual(result[0].id, "high");
  });
});

// ── collapseNode ─────────────────────────────────────────────────────────────

suite("GraphState — collapseNode", () => {
  test("removes edges matching predicate", () => {
    const gs = new GraphState();
    gs.addEdges([makeEdge("a", "b", 1), makeEdge("a", "c", 2)]);
    const removed = gs.collapseNode((e) => e.to === "b");
    assert.strictEqual(removed.length, 1);
    assert.strictEqual(removed[0].to, "b");
    assert.strictEqual(gs.getEdgesBetween("a", "b").length, 0);
    assert.strictEqual(gs.getEdgesBetween("a", "c").length, 1);
  });

  test("returns empty array when no edges match", () => {
    const gs = new GraphState();
    gs.addEdge(makeEdge("x", "y"));
    const removed = gs.collapseNode((e) => e.from === "z");
    assert.deepStrictEqual(removed, []);
  });

  test("emits edges-removed event when edges are removed", () => {
    const gs = new GraphState();
    gs.addEdge(makeEdge("a", "b"));
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.collapseNode(() => true);
    assert.strictEqual(events[0].type, "edges-removed");
  });

  test("does not emit event when nothing is removed", () => {
    const gs = new GraphState();
    const events: GraphChangeEvent[] = [];
    gs.subscribe((e) => events.push(e));
    gs.collapseNode(() => false);
    assert.strictEqual(events.length, 0);
  });
});

// ── clear & getStats ──────────────────────────────────────────────────────────

suite("GraphState — clear and getStats", () => {
  test("clear wipes all nodes and edges", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("a"), makeNode("b")]);
    gs.addEdge(makeEdge("a", "b"));
    gs.clear();
    assert.strictEqual(gs.getAllNodes().length, 0);
    assert.strictEqual(gs.getEdges().length, 0);
  });

  test("getStats reflects current node and edge counts", () => {
    const gs = new GraphState();
    gs.addNodes([makeNode("a"), makeNode("b")]);
    gs.addEdge(makeEdge("a", "b"));
    const stats = gs.getStats();
    assert.strictEqual(stats.nodes, 2);
    assert.strictEqual(stats.edges, 1);
  });

  test("getStats returns zero after clear", () => {
    const gs = new GraphState();
    gs.addNode(makeNode("a"));
    gs.clear();
    const stats = gs.getStats();
    assert.strictEqual(stats.nodes, 0);
    assert.strictEqual(stats.edges, 0);
  });
});
