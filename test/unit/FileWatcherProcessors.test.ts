import * as assert from "assert";
import sinon from "sinon";
import path from "path";
import {
  onFileChange,
  onPrefetchFiles,
} from "../../src/core/processors/FileWatcher.js";
import { buildCtx, makeNode, makeTask } from "./helpers.js";

// Real fixture file — no module stubbing (ESM live bindings freeze the VS Code test runner)
// Use __dirname so the path resolves correctly in the VS Code test runner
// (process.cwd() points to the VS Code install dir, not the project root)
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const FIXTURE = path.join(PROJECT_ROOT, "test/fixtures/sample.ts");
const FIXTURE_DIR = path.join(PROJECT_ROOT, "test/fixtures");

suite("Processor — FileWatcher", () => {
  teardown(() => sinon.restore());

  // ── onFileChange ───────────────────────────────────────────────────────────

  suite("onFileChange", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(
        await onFileChange(makeTask("file-change", { filePath: FIXTURE }), undefined),
        false,
      );
    });

    test("returns false when filePath is missing", async () => {
      assert.strictEqual(await onFileChange(makeTask("file-change"), buildCtx()), false);
    });

    suite("delete changeType", () => {
      test("removes all nodes belonging to the deleted file", async () => {
        const nodes = [makeNode(`${FIXTURE}:1:0:Fn`), makeNode("/other/b.ts:1:0:Fn")];
        const ctx = buildCtx(nodes);

        await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "delete" }), ctx);

        const removed = (ctx.graph.removeNodes as sinon.SinonStub).firstCall.args[0];
        assert.ok(removed.includes(`${FIXTURE}:1:0:Fn`));
        assert.ok(!removed.includes("/other/b.ts:1:0:Fn"));
      });

      test("deletes removed node ids from cache", async () => {
        const staleId = `${FIXTURE}:1:0:Fn`;
        const ctx = buildCtx([makeNode(staleId)]);

        await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "delete" }), ctx);

        assert.ok((ctx.cache.delete as sinon.SinonStub).calledWith(staleId));
      });

      test("calls semanticIndex.removeNode with the file path", async () => {
        const ctx = buildCtx([makeNode(`${FIXTURE}:1:0:Fn`)]);

        await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "delete" }), ctx);

        assert.ok((ctx.semanticIndex.removeNode as sinon.SinonStub).calledWith(FIXTURE));
      });

      test("returns true on delete success", async () => {
        const ctx = buildCtx();
        assert.strictEqual(
          await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "delete" }), ctx),
          true,
        );
      });
    });

    suite("update changeType — real file", () => {
      test("returns false when file does not exist", async () => {
        const ctx = buildCtx();
        assert.strictEqual(
          await onFileChange(makeTask("file-change", { filePath: "/nonexistent/file.ts", changeType: "update" }), ctx),
          false,
        );
      });

      test("removes stale nodes for the file before adding fresh ones", async () => {
        const staleId = `${FIXTURE}:1:0:OldFn`;
        const ctx = buildCtx([makeNode(staleId)]);

        await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "update" }), ctx);

        const removed = (ctx.graph.removeNodes as sinon.SinonStub).firstCall.args[0];
        assert.ok(removed.includes(staleId));
        assert.ok((ctx.graph.addNodes as sinon.SinonStub).calledOnce);
      });

      test("caches fresh nodes after re-parse", async () => {
        const ctx = buildCtx();
        await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "update" }), ctx);
        assert.ok((ctx.cache.set as sinon.SinonStub).callCount > 0);
      });

      test("rebuilds semantic index after update", async () => {
        const ctx = buildCtx();
        await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "update" }), ctx);
        assert.ok((ctx.semanticIndex.rebuild as sinon.SinonStub).calledOnce);
      });

      test("returns true on successful update", async () => {
        const ctx = buildCtx();
        assert.strictEqual(
          await onFileChange(makeTask("file-change", { filePath: FIXTURE, changeType: "update" }), ctx),
          true,
        );
      });
    });
  });

  // ── onPrefetchFiles ────────────────────────────────────────────────────────

  suite("onPrefetchFiles", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(
        await onPrefetchFiles(makeTask("prefetch-files", { nodeId: `${FIXTURE}:1:0:Fn` }), undefined),
        false,
      );
    });

    test("returns false when nodeId is missing", async () => {
      assert.strictEqual(await onPrefetchFiles(makeTask("prefetch-files"), buildCtx()), false);
    });

    test("returns false when node is not in graph or cache", async () => {
      const ctx = buildCtx();
      assert.strictEqual(
        await onPrefetchFiles(makeTask("prefetch-files", { nodeId: "/nonexistent.ts:1:0:Fn" }), ctx),
        false,
      );
    });

    test("skips files already present in the graph", async () => {
      const nodeId = `${FIXTURE}:1:0:Fn`;
      // Pre-populate the graph with a node whose id starts with the fixture path
      // so the prefetch logic skips it as already parsed
      const existingNode = makeNode(nodeId);
      const ctx = buildCtx([existingNode]);

      await onPrefetchFiles(makeTask("prefetch-files", { nodeId }), ctx);

      // addNodes should not have been called — nothing new to add
      assert.ok((ctx.graph.addNodes as sinon.SinonStub).notCalled);
    });

    test("parses neighbour files at depth 1 from the node's directory", async () => {
      // Use a nodeId whose file path IS the fixture; the fixture directory
      // is the neighbourhood to prefetch — but since no other file starts
      // with that path in the graph, the processor will attempt to parse them.
      const nodeId = `${FIXTURE}:1:0:Fn`;
      const ctx = buildCtx([makeNode(nodeId)]);

      const result = await onPrefetchFiles(
        makeTask("prefetch-files", { nodeId, depth: 1 }),
        ctx,
      );

      assert.strictEqual(result, true);
    });

    test("returns true on success", async () => {
      const nodeId = `${FIXTURE}:1:0:Fn`;
      const ctx = buildCtx([makeNode(nodeId)]);
      assert.strictEqual(
        await onPrefetchFiles(makeTask("prefetch-files", { nodeId }), ctx),
        true,
      );
    });
  });
});
