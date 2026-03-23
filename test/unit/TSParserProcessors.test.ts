// import * as assert from "assert";
// import sinon from "sinon";
// import path from "path";
// import { fileURLToPath } from "url";
// import {
//   onBuildInitialGraph,
//   onParseFile,
//   onBatchProcessFiles,
// } from "../../src/core/processors/TSParser.js";
// import { buildCtx, makeNode, makeTask } from "./helpers.js";

// // Real fixture file — no module stubbing (ESM live bindings freeze the VS Code test runner)
// // Use import.meta.url so the path resolves correctly in the VS Code test runner
// // (process.cwd() points to the VS Code install dir, not the project root)
// const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// const FIXTURE = path.join(PROJECT_ROOT, "test/fixtures/sample.ts");
// const FIXTURE_DIR = path.join(PROJECT_ROOT, "test/fixtures");

// suite("Processor — TSParser", () => {
//   teardown(() => sinon.restore());

//   // ── onBuildInitialGraph ────────────────────────────────────────────────────

//   suite("onBuildInitialGraph", () => {
//     test("returns false when ctx is undefined", async () => {
//       assert.strictEqual(
//         await onBuildInitialGraph(makeTask("build-initial-graph", { rootDir: FIXTURE_DIR, depth: 1 }), undefined),
//         false,
//       );
//     });

//     test("adds nodes to graph for source files found at depth 1", async () => {
//       const ctx = buildCtx();
//       await onBuildInitialGraph(makeTask("build-initial-graph", { rootDir: FIXTURE_DIR, depth: 1 }), ctx);

//       const added = (ctx.graph.addNodes as sinon.SinonStub).firstCall?.args[0] ?? [];
//       assert.ok(Array.isArray(added));
//       assert.ok(added.length > 0, "should have parsed at least one node from sample.ts");
//     });

//     test("caches every parsed node", async () => {
//       const ctx = buildCtx();
//       await onBuildInitialGraph(makeTask("build-initial-graph", { rootDir: FIXTURE_DIR, depth: 1 }), ctx);

//       assert.ok((ctx.cache.set as sinon.SinonStub).callCount > 0);
//     });

//     test("calls graph.addEdges after building nodes", async () => {
//       const ctx = buildCtx();
//       await onBuildInitialGraph(makeTask("build-initial-graph", { rootDir: FIXTURE_DIR, depth: 1 }), ctx);

//       assert.ok((ctx.graph.addEdges as sinon.SinonStub).calledOnce);
//     });

//     test("returns true on success", async () => {
//       const ctx = buildCtx();
//       assert.strictEqual(
//         await onBuildInitialGraph(makeTask("build-initial-graph", { rootDir: FIXTURE_DIR, depth: 1 }), ctx),
//         true,
//       );
//     });

//     test("returns true with empty directory (no source files found)", async () => {
//       // depth 0 is unbounded but an empty temp dir should still succeed gracefully
//       const ctx = buildCtx();
//       const result = await onBuildInitialGraph(
//         makeTask("build-initial-graph", { rootDir: process.cwd(), depth: 0 }),
//         ctx,
//       );
//       assert.strictEqual(result, true);
//     });
//   });

//   // ── onParseFile ────────────────────────────────────────────────────────────

//   suite("onParseFile", () => {
//     test("returns false when ctx is undefined", async () => {
//       assert.strictEqual(
//         await onParseFile(makeTask("parse-file", { filePath: FIXTURE }), undefined),
//         false,
//       );
//     });

//     test("returns false when filePath is missing", async () => {
//       assert.strictEqual(await onParseFile(makeTask("parse-file"), buildCtx()), false);
//     });

//     test("returns false when filePath is not a source file", async () => {
//       assert.strictEqual(
//         await onParseFile(makeTask("parse-file", { filePath: "/some/file.md" }), buildCtx()),
//         false,
//       );
//     });

//     test("returns false when file does not exist", async () => {
//       assert.strictEqual(
//         await onParseFile(makeTask("parse-file", { filePath: "/nonexistent/file.ts" }), buildCtx()),
//         false,
//       );
//     });

//     test("adds parsed nodes to graph", async () => {
//       const ctx = buildCtx();
//       await onParseFile(makeTask("parse-file", { filePath: FIXTURE }), ctx);

//       const added = (ctx.graph.addNodes as sinon.SinonStub).firstCall?.args[0] ?? [];
//       assert.ok(added.length > 0);
//     });

//     test("caches every parsed node", async () => {
//       const ctx = buildCtx();
//       await onParseFile(makeTask("parse-file", { filePath: FIXTURE }), ctx);

//       assert.ok((ctx.cache.set as sinon.SinonStub).callCount > 0);
//     });

//     test("calls graph.addEdges after parsing", async () => {
//       const ctx = buildCtx();
//       await onParseFile(makeTask("parse-file", { filePath: FIXTURE }), ctx);

//       assert.ok((ctx.graph.addEdges as sinon.SinonStub).calledOnce);
//     });

//     test("returns true on successful parse", async () => {
//       const ctx = buildCtx();
//       assert.strictEqual(
//         await onParseFile(makeTask("parse-file", { filePath: FIXTURE }), ctx),
//         true,
//       );
//     });
//   });

//   // ── onBatchProcessFiles ────────────────────────────────────────────────────

//   suite("onBatchProcessFiles", () => {
//     test("returns false when ctx is undefined", async () => {
//       assert.strictEqual(
//         await onBatchProcessFiles(makeTask("batch-process-files", { filePaths: [FIXTURE] }), undefined),
//         false,
//       );
//     });

//     test("returns false when filePaths is empty", async () => {
//       assert.strictEqual(
//         await onBatchProcessFiles(makeTask("batch-process-files", { filePaths: [] }), buildCtx()),
//         false,
//       );
//     });

//     test("skips non-source file paths and still succeeds", async () => {
//       const ctx = buildCtx();
//       // Only the .ts fixture is valid; the .md should be silently skipped
//       const result = await onBatchProcessFiles(
//         makeTask("batch-process-files", { filePaths: [FIXTURE, "/some/file.md"] }),
//         ctx,
//       );
//       assert.strictEqual(result, true);
//       const added = (ctx.graph.addNodes as sinon.SinonStub).firstCall?.args[0] ?? [];
//       assert.ok(added.length > 0);
//     });

//     test("parses all valid source files and merges nodes into graph in one addNodes call", async () => {
//       const ctx = buildCtx();
//       await onBatchProcessFiles(makeTask("batch-process-files", { filePaths: [FIXTURE, FIXTURE] }), ctx);

//       // addNodes called once with merged results
//       assert.strictEqual((ctx.graph.addNodes as sinon.SinonStub).callCount, 1);
//     });

//     test("returns true on success", async () => {
//       const ctx = buildCtx();
//       assert.strictEqual(
//         await onBatchProcessFiles(makeTask("batch-process-files", { filePaths: [FIXTURE] }), ctx),
//         true,
//       );
//     });
//   });
// });
