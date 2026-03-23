import * as assert from "assert";
import sinon from "sinon";
import {
  onUpdateCache,
  onClearExpiredCache,
  onInvalidateCache,
} from "../../src/core/processors/Cache.js";
import { buildCtx, makeNode, makeTask } from "./helpers.js";

suite("Processor — Cache", () => {
  teardown(() => sinon.restore());

  // ── onUpdateCache ──────────────────────────────────────────────────────────

  suite("onUpdateCache", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onUpdateCache(makeTask("update-cache", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onUpdateCache(makeTask("update-cache"), buildCtx()), false);
    });

    test("returns false when node is not in graph", async () => {
      const ctx = buildCtx();
      (ctx.graph.getNode as sinon.SinonStub).returns(undefined);
      assert.strictEqual(await onUpdateCache(makeTask("update-cache", { nodeId: "missing" }), ctx), false);
    });

    test("sets node in cache when found in graph", async () => {
      const node = makeNode("a");
      const ctx = buildCtx([node]);

      await onUpdateCache(makeTask("update-cache", { nodeId: "a" }), ctx);

      assert.ok((ctx.cache.set as sinon.SinonStub).calledWith("a", node));
    });

    test("returns true on success", async () => {
      const ctx = buildCtx([makeNode("a")]);
      assert.strictEqual(await onUpdateCache(makeTask("update-cache", { nodeId: "a" }), ctx), true);
    });
  });

  // ── onClearExpiredCache ────────────────────────────────────────────────────

  suite("onClearExpiredCache", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onClearExpiredCache(makeTask("clear-expired-cache"), undefined), false);
    });

    test("calls cache.clear()", async () => {
      const ctx = buildCtx();
      await onClearExpiredCache(makeTask("clear-expired-cache"), ctx);
      assert.ok((ctx.cache.clear as sinon.SinonStub).calledOnce);
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onClearExpiredCache(makeTask("clear-expired-cache"), buildCtx()), true);
    });
  });

  // ── onInvalidateCache ──────────────────────────────────────────────────────

  suite("onInvalidateCache", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onInvalidateCache(makeTask("invalidate-cache", { nodeId: "a" }), undefined), false);
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onInvalidateCache(makeTask("invalidate-cache"), buildCtx()), false);
    });

    test("calls cache.delete with the correct nodeId", async () => {
      const ctx = buildCtx();
      await onInvalidateCache(makeTask("invalidate-cache", { nodeId: "a" }), ctx);
      assert.ok((ctx.cache.delete as sinon.SinonStub).calledWith("a"));
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onInvalidateCache(makeTask("invalidate-cache", { nodeId: "a" }), ctx), true);
    });
  });
});
