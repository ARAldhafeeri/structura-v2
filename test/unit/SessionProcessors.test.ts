import * as assert from "assert";
import sinon from "sinon";
import {
  onNodeClick,
  onNodeHover,
  onActiveFileChanged,
  onToggleGraph,
  onExpandSelectedNode,
  onDeselectAllNodes,
  onViewportChange,
  onNodeDragDrop,
  onSelectNode,
  onPinNode,
  onHideNode,
} from "../../src/core/processors/Session.js";
import { buildCtx, makeNode, makeEdge, makeTask } from "./helpers.js";

suite("Processor — Session", () => {
  teardown(() => sinon.restore());

  // ── onNodeClick ────────────────────────────────────────────────────────────

  suite("onNodeClick", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onNodeClick(makeTask("node-click", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onNodeClick(makeTask("node-click"), buildCtx()), false);
    });

    test("returns false when node is not in graph", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onNodeClick(makeTask("node-click", { nodeId: "x" }), ctx), false);
    });

    test("posts highlight with the clicked node and its connections", async () => {
      const ctx = buildCtx([makeNode("a"), makeNode("b")], [makeEdge("a", "b")]);

      await onNodeClick(makeTask("node-click", { nodeId: "a" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "highlight");
      assert.strictEqual(msg.primary, "a");
      assert.ok(msg.nodeIds.includes("a"));
      assert.ok(msg.nodeIds.includes("b"));
    });

    test("returns true on success", async () => {
      const ctx = buildCtx([makeNode("a")]);
      assert.strictEqual(await onNodeClick(makeTask("node-click", { nodeId: "a" }), ctx), true);
    });
  });

  // ── onNodeHover ────────────────────────────────────────────────────────────

  suite("onNodeHover", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onNodeHover(makeTask("node-hover", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onNodeHover(makeTask("node-hover"), buildCtx()), false);
    });

    test("returns false when node is not in graph or cache", async () => {
      const ctx = buildCtx();
      (ctx.cache.get as sinon.SinonStub).returns(undefined);
      assert.strictEqual(await onNodeHover(makeTask("node-hover", { nodeId: "x" }), ctx), false);
    });

    test("posts tooltip to webview with node info", async () => {
      const node = makeNode("a", { name: "myFunc" });
      const ctx = buildCtx([node]);

      await onNodeHover(makeTask("node-hover", { nodeId: "a" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "tooltip");
      assert.strictEqual(msg.nodeId, "a");
      assert.strictEqual(msg.info.name, "myFunc");
    });

    test("falls back to cache when node is not in graph", async () => {
      const node = makeNode("a");
      const ctx = buildCtx();
      (ctx.cache.get as sinon.SinonStub).callsFake((id: string) => id === "a" ? node : undefined);

      const result = await onNodeHover(makeTask("node-hover", { nodeId: "a" }), ctx);
      assert.strictEqual(result, true);
    });
  });

  // ── onActiveFileChanged ────────────────────────────────────────────────────

  suite("onActiveFileChanged", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onActiveFileChanged(makeTask("active-file-changed", { filePath: "/a.ts" }), undefined), false);
    });

    test("returns false when filePath is missing", async () => {
      assert.strictEqual(await onActiveFileChanged(makeTask("active-file-changed"), buildCtx()), false);
    });

    test("posts focusFile with matching node ids for the given file", async () => {
      const nodes = [
        makeNode("/src/a.ts:1:0:Fn"),
        makeNode("/src/a.ts:5:0:Cls"),
        makeNode("/src/b.ts:1:0:Fn"),
      ];
      const ctx = buildCtx(nodes);

      await onActiveFileChanged(makeTask("active-file-changed", { filePath: "/src/a.ts" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "focusFile");
      assert.strictEqual(msg.filePath, "/src/a.ts");
      assert.strictEqual(msg.nodeIds.length, 2);
      assert.ok(msg.nodeIds.every((id: string) => id.startsWith("/src/a.ts")));
    });
  });

  // ── onToggleGraph ──────────────────────────────────────────────────────────

  suite("onToggleGraph", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onToggleGraph(makeTask("toggle-graph"), undefined), false);
    });

    test("returns false when webview is absent", async () => {
      const ctx = buildCtx();
      (ctx as any).webview = undefined;
      assert.strictEqual(await onToggleGraph(makeTask("toggle-graph"), ctx), false);
    });

    test("calls show() when webview is not visible", async () => {
      const ctx = buildCtx();
      (ctx.webview!.isVisible as sinon.SinonStub).returns(false);

      await onToggleGraph(makeTask("toggle-graph"), ctx);

      assert.ok((ctx.webview!.show as sinon.SinonStub).calledOnce);
      assert.ok((ctx.webview!.hide as sinon.SinonStub).notCalled);
    });

    test("calls hide() when webview is visible", async () => {
      const ctx = buildCtx();
      (ctx.webview!.isVisible as sinon.SinonStub).returns(true);

      await onToggleGraph(makeTask("toggle-graph"), ctx);

      assert.ok((ctx.webview!.hide as sinon.SinonStub).calledOnce);
      assert.ok((ctx.webview!.show as sinon.SinonStub).notCalled);
    });
  });

  // ── onExpandSelectedNode ───────────────────────────────────────────────────

  suite("onExpandSelectedNode", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onExpandSelectedNode(makeTask("expand-selected-node", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onExpandSelectedNode(makeTask("expand-selected-node"), buildCtx()), false);
    });

    test("calls graph.expandNode and caches expanded nodes", async () => {
      const expanded = [makeNode("b"), makeNode("c")];
      const ctx = buildCtx([makeNode("a")]);
      (ctx.graph.expandNode as sinon.SinonStub).returns(expanded);

      await onExpandSelectedNode(makeTask("expand-selected-node", { nodeId: "a" }), ctx);

      assert.strictEqual((ctx.cache.set as sinon.SinonStub).callCount, 2);
    });

    test("posts nodesAdded to webview", async () => {
      const ctx = buildCtx([makeNode("a")]);
      (ctx.graph.expandNode as sinon.SinonStub).returns([makeNode("b")]);

      await onExpandSelectedNode(makeTask("expand-selected-node", { nodeId: "a" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "nodesAdded");
    });
  });

  // ── onDeselectAllNodes ─────────────────────────────────────────────────────

  suite("onDeselectAllNodes", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onDeselectAllNodes(makeTask("deselect-all-nodes"), undefined), false);
    });

    test("posts clearSelection to webview", async () => {
      const ctx = buildCtx();
      await onDeselectAllNodes(makeTask("deselect-all-nodes"), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "clearSelection");
    });
  });

  // ── onViewportChange ───────────────────────────────────────────────────────

  suite("onViewportChange", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onViewportChange(makeTask("viewport-change", { viewport: {} }), undefined), false);
    });

    test("returns false when viewport is missing", async () => {
      assert.strictEqual(await onViewportChange(makeTask("viewport-change"), buildCtx()), false);
    });

    test("posts viewportAck with the provided viewport", async () => {
      const viewport = { zoom: 1.5, pan: { x: 10, y: 20 } };
      const ctx = buildCtx();
      await onViewportChange(makeTask("viewport-change", { viewport }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "viewportAck");
      assert.deepStrictEqual(msg.viewport, viewport);
    });
  });

  // ── onNodeDragDrop ─────────────────────────────────────────────────────────

  suite("onNodeDragDrop", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onNodeDragDrop(makeTask("node-drag-drop", { nodeId: "a", position: {} }), undefined), false);
    });

    test("returns false when nodeId or position is missing", async () => {
      const ctx = buildCtx([makeNode("a")]);
      assert.strictEqual(await onNodeDragDrop(makeTask("node-drag-drop", { nodeId: "a" }), ctx), false);
    });

    test("updates node metadata with new position", async () => {
      const node = makeNode("a");
      const ctx = buildCtx([node]);
      const position = { x: 100, y: 200 };

      await onNodeDragDrop(makeTask("node-drag-drop", { nodeId: "a", position }), ctx);

      const [id, patch] = (ctx.graph.updateNode as sinon.SinonStub).firstCall.args;
      assert.strictEqual(id, "a");
      assert.deepStrictEqual(patch.metadata.position, position);
    });

    test("posts nodePositionUpdated to webview", async () => {
      const ctx = buildCtx([makeNode("a")]);
      const position = { x: 0, y: 0 };
      await onNodeDragDrop(makeTask("node-drag-drop", { nodeId: "a", position }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "nodePositionUpdated");
    });
  });

  // ── onSelectNode ───────────────────────────────────────────────────────────

  suite("onSelectNode", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onSelectNode(makeTask("select-node", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onSelectNode(makeTask("select-node"), buildCtx()), false);
    });

    test("posts selectNode to webview", async () => {
      const ctx = buildCtx();
      await onSelectNode(makeTask("select-node", { nodeId: "a" }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "selectNode");
      assert.strictEqual(msg.nodeId, "a");
    });
  });

  // ── onPinNode ──────────────────────────────────────────────────────────────

  suite("onPinNode", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onPinNode(makeTask("pin-node", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onPinNode(makeTask("pin-node"), buildCtx()), false);
    });

    test("returns false when node is not in graph", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onPinNode(makeTask("pin-node", { nodeId: "x" }), ctx), false);
    });

    test("toggles pinned flag from false to true", async () => {
      const node = makeNode("a", { metadata: { nodeType: "Fn", pinned: false } });
      const ctx = buildCtx([node]);

      await onPinNode(makeTask("pin-node", { nodeId: "a" }), ctx);

      const [, patch] = (ctx.graph.updateNode as sinon.SinonStub).firstCall.args;
      assert.strictEqual(patch.metadata.pinned, true);
    });

    test("toggles pinned flag from true to false", async () => {
      const node = makeNode("a", { metadata: { nodeType: "Fn", pinned: true } });
      const ctx = buildCtx([node]);

      await onPinNode(makeTask("pin-node", { nodeId: "a" }), ctx);

      const [, patch] = (ctx.graph.updateNode as sinon.SinonStub).firstCall.args;
      assert.strictEqual(patch.metadata.pinned, false);
    });

    test("posts nodePinned to webview", async () => {
      const ctx = buildCtx([makeNode("a")]);
      await onPinNode(makeTask("pin-node", { nodeId: "a" }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "nodePinned");
    });
  });

  // ── onHideNode ─────────────────────────────────────────────────────────────

  suite("onHideNode", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onHideNode(makeTask("hide-node", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onHideNode(makeTask("hide-node"), buildCtx()), false);
    });

    test("moves the node to cache before removing from graph", async () => {
      const node = makeNode("a");
      const ctx = buildCtx([node]);

      await onHideNode(makeTask("hide-node", { nodeId: "a" }), ctx);

      assert.ok((ctx.cache.set as sinon.SinonStub).calledWith("a", node));
      assert.ok((ctx.graph.removeNode as sinon.SinonStub).calledWith("a"));
    });

    test("posts nodeHidden to webview", async () => {
      const ctx = buildCtx([makeNode("a")]);
      await onHideNode(makeTask("hide-node", { nodeId: "a" }), ctx);
      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "nodeHidden");
      assert.strictEqual(msg.nodeId, "a");
    });
  });
});
