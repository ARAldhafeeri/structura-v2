import * as assert from "assert";
import sinon from "sinon";
import {
  onInitializeGraph,
  onExpandNode,
  onCollapseNode,
  onSendGraphToWebview,
  onHighlightNodes,
  onUpdateLayout,
} from "../../src/core/processors/GraphState.js";
import { buildCtx, makeNode, makeEdge, makeTask } from "./helpers.js";

suite("Processor — GraphState", () => {
  teardown(() => sinon.restore());

  // ── onInitializeGraph ──────────────────────────────────────────────────────

  suite("onInitializeGraph", () => {
    test("returns false when ctx is undefined", async () => {
      const result = await onInitializeGraph(makeTask("initialize-graph"), undefined);
      assert.strictEqual(result, false);
    });

    test("calls graph.clear()", async () => {
      const ctx = buildCtx();
      await onInitializeGraph(makeTask("initialize-graph"), ctx);
      assert.ok((ctx.graph.clear as sinon.SinonStub).calledOnce);
    });

    test("returns true on success", async () => {
      const result = await onInitializeGraph(makeTask("initialize-graph"), buildCtx());
      assert.strictEqual(result, true);
    });
  });

  // ── onExpandNode ───────────────────────────────────────────────────────────

  suite("onExpandNode", () => {
    test("returns false when ctx is undefined", async () => {
      const result = await onExpandNode(makeTask("expand-node", { nodeId: "a" }), undefined);
      assert.strictEqual(result, false);
    });

    test("returns false when nodeId is missing", async () => {
      const result = await onExpandNode(makeTask("expand-node"), buildCtx());
      assert.strictEqual(result, false);
    });

    test("calls graph.expandNode with the correct predicate and default policy", async () => {
      const ctx = buildCtx([makeNode("a")]);
      (ctx.graph.expandNode as sinon.SinonStub).returns([makeNode("b")]);

      await onExpandNode(makeTask("expand-node", { nodeId: "a" }), ctx);

      const [predicate, policy] = (ctx.graph.expandNode as sinon.SinonStub).firstCall.args;
      assert.ok(predicate(makeNode("a")));
      assert.ok(!predicate(makeNode("other")));
      assert.strictEqual(policy.maxDepth, 3);
    });

    test("caches each expanded node", async () => {
      const expanded = [makeNode("b"), makeNode("c")];
      const ctx = buildCtx([makeNode("a")]);
      (ctx.graph.expandNode as sinon.SinonStub).returns(expanded);

      await onExpandNode(makeTask("expand-node", { nodeId: "a" }), ctx);

      assert.strictEqual((ctx.cache.set as sinon.SinonStub).callCount, 2);
    });

    test("posts nodesAdded to webview", async () => {
      const expanded = [makeNode("b")];
      const ctx = buildCtx([makeNode("a")]);
      (ctx.graph.expandNode as sinon.SinonStub).returns(expanded);

      await onExpandNode(makeTask("expand-node", { nodeId: "a" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "nodesAdded");
    });

    test("uses policy from task.data when provided", async () => {
      const ctx = buildCtx([makeNode("a")]);
      const policy = { maxDepth: 1, maxNodesPerLevel: 5, fanOutLimit: 2, weightThreshold: 0, stopOnCycles: false, order: [], includeExternal: false };

      await onExpandNode(makeTask("expand-node", { nodeId: "a", policy }), ctx);

      const [, usedPolicy] = (ctx.graph.expandNode as sinon.SinonStub).firstCall.args;
      assert.strictEqual(usedPolicy.maxDepth, 1);
    });

    test("returns true on success", async () => {
      const ctx = buildCtx([makeNode("a")]);
      const result = await onExpandNode(makeTask("expand-node", { nodeId: "a" }), ctx);
      assert.strictEqual(result, true);
    });
  });

  // ── onCollapseNode ─────────────────────────────────────────────────────────

  suite("onCollapseNode", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onCollapseNode(makeTask("collapse-node", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onCollapseNode(makeTask("collapse-node"), buildCtx()), false);
    });

    test("calls graph.collapseNode with predicate that matches outgoing edges", async () => {
      const ctx = buildCtx();
      (ctx.graph.collapseNode as sinon.SinonStub).returns([]);

      await onCollapseNode(makeTask("collapse-node", { nodeId: "a" }), ctx);

      const [predicate] = (ctx.graph.collapseNode as sinon.SinonStub).firstCall.args;
      assert.ok(predicate(makeEdge("a", "b")));
      assert.ok(!predicate(makeEdge("x", "b")));
    });

    test("caches children that were removed", async () => {
      const child = makeNode("b");
      const ctx = buildCtx([makeNode("a"), child]);
      (ctx.graph.collapseNode as sinon.SinonStub).returns([makeEdge("a", "b")]);
      (ctx.graph.getNode as sinon.SinonStub).callsFake((id: string) => id === "b" ? child : undefined);

      await onCollapseNode(makeTask("collapse-node", { nodeId: "a" }), ctx);

      assert.ok((ctx.cache.set as sinon.SinonStub).calledWith("b", child));
    });

    test("posts edgesRemoved to webview", async () => {
      const ctx = buildCtx();
      (ctx.graph.collapseNode as sinon.SinonStub).returns([makeEdge("a", "b")]);

      await onCollapseNode(makeTask("collapse-node", { nodeId: "a" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "edgesRemoved");
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      (ctx.graph.collapseNode as sinon.SinonStub).returns([]);
      assert.strictEqual(await onCollapseNode(makeTask("collapse-node", { nodeId: "a" }), ctx), true);
    });
  });

  // ── onSendGraphToWebview ───────────────────────────────────────────────────

  suite("onSendGraphToWebview", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onSendGraphToWebview(makeTask("send-graph-to-webview"), undefined), false);
    });

    test("returns false when webview is absent", async () => {
      const ctx = buildCtx();
      (ctx as any).webview = undefined;
      assert.strictEqual(await onSendGraphToWebview(makeTask("send-graph-to-webview"), ctx), false);
    });

    test("posts graphData with nodes and edges from graph.state", async () => {
      const nodes = [makeNode("a")];
      const edges = [makeEdge("a", "b")];
      const ctx = buildCtx(nodes, edges);

      await onSendGraphToWebview(makeTask("send-graph-to-webview"), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "graphData");
      assert.deepStrictEqual(msg.nodes, nodes);
      assert.deepStrictEqual(msg.edges, edges);
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onSendGraphToWebview(makeTask("send-graph-to-webview"), buildCtx()), true);
    });
  });

  // ── onHighlightNodes ───────────────────────────────────────────────────────

  suite("onHighlightNodes", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onHighlightNodes(makeTask("highlight-nodes"), undefined), false);
    });

    test("posts highlight command with nodeIds and color", async () => {
      const ctx = buildCtx();
      await onHighlightNodes(makeTask("highlight-nodes", { nodeIds: ["a", "b"], color: "red" }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "highlight");
      assert.deepStrictEqual(msg.nodeIds, ["a", "b"]);
      assert.strictEqual(msg.color, "red");
    });

    test("defaults color to accent when not provided", async () => {
      const ctx = buildCtx();
      await onHighlightNodes(makeTask("highlight-nodes", { nodeIds: [] }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.color, "accent");
    });
  });

  // ── onUpdateLayout ─────────────────────────────────────────────────────────

  suite("onUpdateLayout", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onUpdateLayout(makeTask("update-layout"), undefined), false);
    });

    test("posts updateLayout command with layout name", async () => {
      const ctx = buildCtx();
      await onUpdateLayout(makeTask("update-layout", { layout: "tree" }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "updateLayout");
      assert.strictEqual(msg.layout, "tree");
    });

    test("defaults layout to force when not provided", async () => {
      const ctx = buildCtx();
      await onUpdateLayout(makeTask("update-layout"), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.layout, "force");
    });
  });
});
