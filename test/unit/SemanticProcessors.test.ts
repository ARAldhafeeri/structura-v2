import * as assert from "assert";
import sinon from "sinon";
import {
  onBuildSemanticIndex,
  onUpdateNodeIndex,
  onRemoveNodeFromIndex,
  onSemanticSearch,
  onSearchSuggestions,
  onClearSemanticIndex,
} from "../../src/core/processors/Semantic.js";
import { buildCtx, makeNode, makeTask } from "./helpers.js";

suite("Processor — Semantic", () => {
  teardown(() => sinon.restore());

  // ── onBuildSemanticIndex ───────────────────────────────────────────────────

  suite("onBuildSemanticIndex", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onBuildSemanticIndex(makeTask("build-semantic-index"), undefined), false);
    });

    test("calls semanticIndex.rebuild with all graph nodes", async () => {
      const nodes = [makeNode("a"), makeNode("b")];
      const ctx = buildCtx(nodes);

      await onBuildSemanticIndex(makeTask("build-semantic-index"), ctx);

      assert.ok((ctx.semanticIndex.rebuild as sinon.SinonStub).calledWith(nodes));
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onBuildSemanticIndex(makeTask("build-semantic-index"), buildCtx()), true);
    });
  });

  // ── onUpdateNodeIndex ──────────────────────────────────────────────────────

  suite("onUpdateNodeIndex", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onUpdateNodeIndex(makeTask("update-node-index", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onUpdateNodeIndex(makeTask("update-node-index"), buildCtx()), false);
    });

    test("calls semanticIndex.addNode with nodeId and embedding", async () => {
      const ctx = buildCtx();
      const embedding = [0.1, 0.2, 0.3];
      await onUpdateNodeIndex(makeTask("update-node-index", { nodeId: "a", embedding }), ctx);
      assert.ok((ctx.semanticIndex.addNode as sinon.SinonStub).calledWith("a", embedding));
    });

    test("defaults to empty embedding when not provided", async () => {
      const ctx = buildCtx();
      await onUpdateNodeIndex(makeTask("update-node-index", { nodeId: "a" }), ctx);
      assert.ok((ctx.semanticIndex.addNode as sinon.SinonStub).calledWith("a", []));
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onUpdateNodeIndex(makeTask("update-node-index", { nodeId: "a" }), ctx), true);
    });
  });

  // ── onRemoveNodeFromIndex ──────────────────────────────────────────────────

  suite("onRemoveNodeFromIndex", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onRemoveNodeFromIndex(makeTask("remove-node-from-index", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onRemoveNodeFromIndex(makeTask("remove-node-from-index"), buildCtx()), false);
    });

    test("calls semanticIndex.removeNode with correct nodeId", async () => {
      const ctx = buildCtx();
      await onRemoveNodeFromIndex(makeTask("remove-node-from-index", { nodeId: "a" }), ctx);
      assert.ok((ctx.semanticIndex.removeNode as sinon.SinonStub).calledWith("a"));
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onRemoveNodeFromIndex(makeTask("remove-node-from-index", { nodeId: "a" }), ctx), true);
    });
  });

  // ── onSemanticSearch ───────────────────────────────────────────────────────

  suite("onSemanticSearch", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onSemanticSearch(makeTask("semantic-search", { query: "foo" }), undefined), false);
    });

    test("returns false when query is missing", async () => {
      assert.strictEqual(await onSemanticSearch(makeTask("semantic-search"), buildCtx()), false);
    });

    test("calls semanticIndex.search with query and limit", async () => {
      const ctx = buildCtx();
      await onSemanticSearch(makeTask("semantic-search", { query: "foo", limit: 5 }), ctx);
      assert.ok((ctx.semanticIndex.search as sinon.SinonStub).calledWith("foo", 5));
    });

    test("defaults limit to 10 when not provided", async () => {
      const ctx = buildCtx();
      await onSemanticSearch(makeTask("semantic-search", { query: "foo" }), ctx);
      assert.ok((ctx.semanticIndex.search as sinon.SinonStub).calledWith("foo", 10));
    });

    test("posts searchResults to webview", async () => {
      const ctx = buildCtx();
      const mockResult = { matches: ["x"], score: 0.9 };
      (ctx.semanticIndex.search as sinon.SinonStub).resolves(mockResult);

      await onSemanticSearch(makeTask("semantic-search", { query: "foo" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "searchResults");
      assert.strictEqual(msg.query, "foo");
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onSemanticSearch(makeTask("semantic-search", { query: "foo" }), ctx), true);
    });
  });

  // ── onSearchSuggestions ────────────────────────────────────────────────────

  suite("onSearchSuggestions", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onSearchSuggestions(makeTask("search-suggestions"), undefined), false);
    });

    test("filters nodes by prefix and posts suggestions", async () => {
      const nodes = [
        makeNode("a", { name: "handleClick" }),
        makeNode("b", { name: "handleChange" }),
        makeNode("c", { name: "renderView" }),
      ];
      const ctx = buildCtx(nodes);

      await onSearchSuggestions(makeTask("search-suggestions", { prefix: "handle" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "searchSuggestions");
      assert.strictEqual(msg.suggestions.length, 2);
      assert.ok(msg.suggestions.every((s: any) => s.name.toLowerCase().startsWith("handle")));
    });

    test("returns all nodes when prefix is empty", async () => {
      const nodes = [makeNode("a", { name: "foo" }), makeNode("b", { name: "bar" })];
      const ctx = buildCtx(nodes);

      await onSearchSuggestions(makeTask("search-suggestions", { prefix: "" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.suggestions.length, 2);
    });

    test("caps suggestions at 20", async () => {
      const nodes = Array.from({ length: 30 }, (_, i) => makeNode(`n${i}`, { name: `fn${i}` }));
      const ctx = buildCtx(nodes);

      await onSearchSuggestions(makeTask("search-suggestions", { prefix: "fn" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.ok(msg.suggestions.length <= 20);
    });
  });

  // ── onClearSemanticIndex ───────────────────────────────────────────────────

  suite("onClearSemanticIndex", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onClearSemanticIndex(makeTask("clear-semantic-index"), undefined), false);
    });

    test("calls semanticIndex.clear()", async () => {
      const ctx = buildCtx();
      await onClearSemanticIndex(makeTask("clear-semantic-index"), ctx);
      assert.ok((ctx.semanticIndex.clear as sinon.SinonStub).calledOnce);
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onClearSemanticIndex(makeTask("clear-semantic-index"), buildCtx()), true);
    });
  });
});
