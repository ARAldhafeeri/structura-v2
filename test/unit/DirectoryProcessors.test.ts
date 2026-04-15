import * as assert from "assert";
import sinon from "sinon";
import path from "path";
import {
  onExpandDirectory,
  onListDirectory,
} from "../../src/core/processors/Directory.js";
import { buildCtx, makeNode, makeTask } from "./helpers.js";

// Real directories — no module stubbing (ESM live bindings freeze the VS Code test runner)
// Use __dirname so the path resolves correctly in the VS Code test runner
// (process.cwd() points to the VS Code install dir, not the project root)
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(PROJECT_ROOT, "test/fixtures");
const EMPTY_DIR = path.join(PROJECT_ROOT, "test-workspace");

suite("Processor — Directory", () => {
  teardown(() => sinon.restore());

  // ── onExpandDirectory ──────────────────────────────────────────────────────

  suite("onExpandDirectory", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(
        await onExpandDirectory(makeTask("expand-directory", { dir: FIXTURE_DIR, depth: 1 }), undefined),
        false,
      );
    });

    test("returns true on success with a real directory", async () => {
      const ctx = buildCtx();
      assert.strictEqual(
        await onExpandDirectory(makeTask("expand-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx),
        true,
      );
    });

    test("defaults depth to 1", async () => {
      // Smoke test — just verify it completes without depth in task.data
      const ctx = buildCtx();
      const result = await onExpandDirectory(makeTask("expand-directory", { dir: FIXTURE_DIR }), ctx);
      assert.strictEqual(result, true);
    });

    test("adds parsed source file nodes to graph", async () => {
      const ctx = buildCtx();
      await onExpandDirectory(makeTask("expand-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx);

      // sample.ts should be discovered and parsed
      const added = (ctx.graph.addNodes as sinon.SinonStub).firstCall?.args[0] ?? [];
      assert.ok(added.length > 0, "expected nodes from sample.ts");
    });

    test("caches parsed nodes", async () => {
      const ctx = buildCtx();
      await onExpandDirectory(makeTask("expand-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx);
      assert.ok((ctx.cache.set as sinon.SinonStub).callCount > 0);
    });

    test("posts nodesAdded to webview with parsed nodes", async () => {
      const ctx = buildCtx();
      await onExpandDirectory(makeTask("expand-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall?.args[0];
      assert.strictEqual(msg?.command, "nodesAdded");
      assert.ok(Array.isArray(msg?.nodes));
    });

    test("returns true with an empty directory (no source files)", async () => {
      const ctx = buildCtx();
      const result = await onExpandDirectory(
        makeTask("expand-directory", { dir: EMPTY_DIR, depth: 1 }),
        ctx,
      );
      assert.strictEqual(result, true);
    });
  });

  // ── onListDirectory ────────────────────────────────────────────────────────

  suite("onListDirectory", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(
        await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR }), undefined),
        false,
      );
    });

    test("returns false when webview is absent", async () => {
      const ctx = buildCtx();
      (ctx as any).webview = undefined;
      assert.strictEqual(
        await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR }), ctx),
        false,
      );
    });

    test("posts directoryTree command to webview", async () => {
      const ctx = buildCtx();
      await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "directoryTree");
    });

    test("includes the requested dir in the posted message", async () => {
      const ctx = buildCtx();
      await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.dir, FIXTURE_DIR);
    });

    test("tree in message is an array", async () => {
      const ctx = buildCtx();
      await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.ok(Array.isArray(msg.tree));
    });

    test("tree contains the fixture source file entry", async () => {
      const ctx = buildCtx();
      await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR, depth: 1 }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      const hasFixture = msg.tree.some((entry: any) =>
        entry.type === "F" && entry.path.includes("sample"),
      );
      assert.ok(hasFixture, "expected sample.ts in the directory tree");
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      assert.strictEqual(
        await onListDirectory(makeTask("list-directory", { dir: FIXTURE_DIR }), ctx),
        true,
      );
    });
  });
});
