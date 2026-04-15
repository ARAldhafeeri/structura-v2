// import * as assert from "assert";
// import * as vscode from "vscode";
// import sinon from "sinon";
// import { buildContext } from "../../src/core/buildContext.js";
// import { GraphState } from "../../src/core/GraphState.js";
// import { CacheState } from "../../src/core/Cache.js";
// import { SessionState } from "../../src/core/Session.js";

// suite("buildContext", () => {
//   // Minimal fake ExtensionContext — only the fields buildContext actually touches.
//   const fakeEditor = {} as vscode.ExtensionContext;

//   teardown(() => sinon.restore());

//   test("returns an object with all required IProcessorContext keys", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.ok(ctx.graph, "ctx.graph must be present");
//     assert.ok(ctx.cache, "ctx.cache must be present");
//     assert.ok(ctx.session, "ctx.session must be present");
//     assert.ok(ctx.semanticIndex, "ctx.semanticIndex must be present");
//     assert.ok(ctx.settings, "ctx.settings must be present");
//     assert.ok(ctx.editor !== undefined, "ctx.editor must be present");
//   });

//   test("graph is a GraphState instance with expected IGraphState methods", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.ok(ctx.graph instanceof GraphState);
//     assert.strictEqual(typeof ctx.graph.addNode, "function");
//     assert.strictEqual(typeof ctx.graph.addNodes, "function");
//     assert.strictEqual(typeof ctx.graph.getNode, "function");
//     assert.strictEqual(typeof ctx.graph.clear, "function");
//     assert.strictEqual(typeof ctx.graph.getStats, "function");
//   });

//   test("cache is a CacheState instance with expected ICacheState methods", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.ok(ctx.cache instanceof CacheState);
//     assert.strictEqual(typeof ctx.cache.get, "function");
//     assert.strictEqual(typeof ctx.cache.set, "function");
//     assert.strictEqual(typeof ctx.cache.has, "function");
//     assert.strictEqual(typeof ctx.cache.delete, "function");
//     assert.strictEqual(typeof ctx.cache.clear, "function");
//   });

//   test("cache capacity is 256", () => {
//     const ctx = buildContext(fakeEditor);
//     // capacity is a public field on CacheState
//     assert.strictEqual((ctx.cache as CacheState).capacity, 256);
//   });

//   test("session is a SessionState instance", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.ok(ctx.session instanceof SessionState);
//     assert.strictEqual(typeof ctx.session.get, "function");
//     assert.strictEqual(typeof ctx.session.set, "function");
//     assert.strictEqual(typeof ctx.session.list, "function");
//   });

//   test("settings exposes get / set / getAll", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.strictEqual(typeof ctx.settings.get, "function");
//     assert.strictEqual(typeof ctx.settings.set, "function");
//     assert.strictEqual(typeof ctx.settings.getAll, "function");
//   });

//   test("settings.getAll returns structura keys", () => {
//     const ctx = buildContext(fakeEditor);
//     const all = ctx.settings.getAll();
//     assert.ok(Object.prototype.hasOwnProperty.call(all, "structura.baseDirectory"));
//     assert.ok(Object.prototype.hasOwnProperty.call(all, "structura.ignorePatterns"));
//   });

//   test("webview is undefined when not provided", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.strictEqual(ctx.webview, undefined);
//   });

//   test("webview is set when provided", () => {
//     const fakeWebview = {
//       postMessage: sinon.stub(),
//       onMessage: sinon.stub(),
//       show: sinon.stub(),
//       hide: sinon.stub(),
//       isVisible: sinon.stub().returns(false),
//     };
//     const ctx = buildContext(fakeEditor, fakeWebview);
//     assert.strictEqual(ctx.webview, fakeWebview);
//   });

//   test("graph starts empty", () => {
//     const ctx = buildContext(fakeEditor);
//     const { nodes, edges } = ctx.graph.state;
//     assert.deepStrictEqual(nodes, []);
//     assert.deepStrictEqual(edges, []);
//   });

//   test("editor reference is forwarded as-is", () => {
//     const ctx = buildContext(fakeEditor);
//     assert.strictEqual(ctx.editor, fakeEditor);
//   });

//   test("each call returns a distinct context (no shared state)", () => {
//     const a = buildContext(fakeEditor);
//     const b = buildContext(fakeEditor);
//     assert.notStrictEqual(a.graph, b.graph);
//     assert.notStrictEqual(a.cache, b.cache);
//   });
// });
