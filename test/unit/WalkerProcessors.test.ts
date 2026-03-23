import * as assert from "assert";
import sinon from "sinon";
import {
  onGarbageCollection,
  onCollectAnalytics,
  onSessionLogging,
} from "../../src/core/processors/Walker.js";
import { buildCtx, makeNode, makeEdge, makeTask } from "./helpers.js";

suite("Processor — Walker", () => {
  teardown(() => sinon.restore());

  // ── onGarbageCollection ────────────────────────────────────────────────────

  suite("onGarbageCollection", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onGarbageCollection(makeTask("garbage-collection"), undefined), false);
    });

    test("removes orphan nodes that have no edges and weight below threshold", async () => {
      const orphan = makeNode("orphan", { weight: 0 });
      const connected = makeNode("connected", { weight: 3 });
      const ctx = buildCtx([orphan, connected], [makeEdge("connected", "other")]);

      await onGarbageCollection(makeTask("garbage-collection"), ctx);

      const removed = (ctx.graph.removeNodes as sinon.SinonStub).firstCall?.args[0] ?? [];
      assert.ok(removed.includes("orphan"));
      assert.ok(!removed.includes("connected"));
    });

    test("does not remove nodes that have edges even if weight is low", async () => {
      const lowWeightButConnected = makeNode("a", { weight: 0 });
      const ctx = buildCtx([lowWeightButConnected], [makeEdge("a", "b")]);

      await onGarbageCollection(makeTask("garbage-collection"), ctx);

      const removeCall = (ctx.graph.removeNodes as sinon.SinonStub).firstCall;
      const removed = removeCall?.args[0] ?? [];
      assert.ok(!removed.includes("a"));
    });

    test("does not remove nodes with weight at or above threshold", async () => {
      const heavyOrphan = makeNode("heavy", { weight: 5 });
      const ctx = buildCtx([heavyOrphan]);

      await onGarbageCollection(makeTask("garbage-collection"), ctx);

      const removed = (ctx.graph.removeNodes as sinon.SinonStub).firstCall?.args[0] ?? [];
      assert.ok(!removed.includes("heavy"));
    });

    test("also deletes orphan ids from cache", async () => {
      const orphan = makeNode("orphan", { weight: 0 });
      const ctx = buildCtx([orphan]);

      await onGarbageCollection(makeTask("garbage-collection"), ctx);

      assert.ok((ctx.cache.delete as sinon.SinonStub).calledWith("orphan"));
    });

    test("returns true on success with no orphans", async () => {
      const ctx = buildCtx([makeNode("a", { weight: 5 })], [makeEdge("a", "b")]);
      assert.strictEqual(await onGarbageCollection(makeTask("garbage-collection"), ctx), true);
    });
  });

  // ── onCollectAnalytics ─────────────────────────────────────────────────────

  suite("onCollectAnalytics", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onCollectAnalytics(makeTask("collect-analytics"), undefined), false);
    });

    test("calls graph.getStats() and cache.getStats()", async () => {
      const ctx = buildCtx();
      await onCollectAnalytics(makeTask("collect-analytics"), ctx);
      assert.ok((ctx.graph.getStats as sinon.SinonStub).calledOnce);
      assert.ok((ctx.cache.getStats as sinon.SinonStub).calledOnce);
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onCollectAnalytics(makeTask("collect-analytics"), buildCtx()), true);
    });
  });

  // ── onSessionLogging ───────────────────────────────────────────────────────

  suite("onSessionLogging", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onSessionLogging(makeTask("session-logging"), undefined), false);
    });

    test("returns true regardless of event data", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onSessionLogging(makeTask("session-logging", { event: "nodeClick", meta: { nodeId: "a" } }), ctx), true);
    });

    test("returns true even when event data is not provided", async () => {
      assert.strictEqual(await onSessionLogging(makeTask("session-logging"), buildCtx()), true);
    });
  });
});
