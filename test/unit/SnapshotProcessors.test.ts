import * as assert from "assert";
import sinon from "sinon";
import {
  onSaveState,
  onLoadState,
  onCreateSnapshot,
  onRestoreSnapshot,
  onUndo,
  onRedo,
} from "../../src/core/processors/Snapshot.js";
import { buildCtx, makeNode, makeEdge, makeTask } from "./helpers.js";
import type { IStracturaSnapshotState } from "../../src/contract/State/Snapshot.js";

// ── Snapshot stub factory ─────────────────────────────────────────────────────

const makeSnapshot = (overrides: Partial<IStracturaSnapshotState> = {}): IStracturaSnapshotState => ({
  head: null,
  tail: null,
  size: 0,
  capacity: 50,
  persist: sinon.stub().resolves("/tmp/snap.json"),
  unpersist: sinon.stub().resolves(undefined),
  getSnapshot: sinon.stub().resolves({ nodes: [], edges: [] }),
  add: sinon.stub(),
  get: sinon.stub().returns(undefined),
  delete: sinon.stub(),
  clear: sinon.stub().resolves(),
  ...overrides,
});

suite("Processor — Snapshot", () => {
  teardown(() => sinon.restore());

  // ── onSaveState ────────────────────────────────────────────────────────────

  suite("onSaveState", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onSaveState(makeTask("save-state"), undefined), false);
    });

    test("creates session when it does not exist, then persists graph state", async () => {
      const snap = makeSnapshot();
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).onFirstCall().returns(undefined).onSecondCall().returns(snap);

      await onSaveState(makeTask("save-state", { sessionId: "s1" }), ctx);

      assert.ok((ctx.session.set as sinon.SinonStub).calledWith("s1"));
      assert.ok((snap.persist as sinon.SinonStub).calledOnce);
    });

    test("persists graph state into existing session", async () => {
      const snap = makeSnapshot();
      const ctx = buildCtx([makeNode("a")]);
      (ctx.session.get as sinon.SinonStub).returns(snap);

      await onSaveState(makeTask("save-state"), ctx);

      const [, data] = (snap.persist as sinon.SinonStub).firstCall.args;
      assert.ok(data.nodes !== undefined);
    });

    test("returns true on success", async () => {
      const snap = makeSnapshot();
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(snap);
      assert.strictEqual(await onSaveState(makeTask("save-state"), ctx), true);
    });
  });

  // ── onLoadState ────────────────────────────────────────────────────────────

  suite("onLoadState", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onLoadState(makeTask("load-state"), undefined), false);
    });

    test("calls session.loadPersistedSessions()", async () => {
      const ctx = buildCtx();
      await onLoadState(makeTask("load-state"), ctx);
      assert.ok((ctx.session.loadPersistedSessions as sinon.SinonStub).calledOnce);
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onLoadState(makeTask("load-state"), buildCtx()), true);
    });
  });

  // ── onCreateSnapshot ───────────────────────────────────────────────────────

  suite("onCreateSnapshot", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onCreateSnapshot(makeTask("create-snapshot"), undefined), false);
    });

    test("persists current graph state with the provided label", async () => {
      const snap = makeSnapshot();
      const ctx = buildCtx([makeNode("a")]);
      (ctx.session.get as sinon.SinonStub).returns(snap);

      await onCreateSnapshot(makeTask("create-snapshot", { sessionId: "s1", label: "my-snap" }), ctx);

      const [label] = (snap.persist as sinon.SinonStub).firstCall.args;
      assert.strictEqual(label, "my-snap");
    });

    test("returns true on success", async () => {
      const snap = makeSnapshot();
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(snap);
      assert.strictEqual(await onCreateSnapshot(makeTask("create-snapshot"), ctx), true);
    });
  });

  // ── onRestoreSnapshot ──────────────────────────────────────────────────────

  suite("onRestoreSnapshot", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onRestoreSnapshot(makeTask("restore-snapshot", { key: "k" }), undefined), false);
    });

    test("returns false when key is missing", async () => {
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(makeSnapshot());
      assert.strictEqual(await onRestoreSnapshot(makeTask("restore-snapshot"), ctx), false);
    });

    test("returns false when session does not exist", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onRestoreSnapshot(makeTask("restore-snapshot", { key: "k" }), ctx), false);
    });

    test("clears graph then restores nodes and edges from snapshot", async () => {
      const restoredNodes = [makeNode("x")];
      const restoredEdges = [makeEdge("x", "y")];
      const snap = makeSnapshot({ getSnapshot: sinon.stub().resolves({ nodes: restoredNodes, edges: restoredEdges }) });
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(snap);

      await onRestoreSnapshot(makeTask("restore-snapshot", { key: "k" }), ctx);

      assert.ok((ctx.graph.clear as sinon.SinonStub).calledOnce);
      assert.ok((ctx.graph.addNodes as sinon.SinonStub).calledWith(restoredNodes));
      assert.ok((ctx.graph.addEdges as sinon.SinonStub).calledWith(restoredEdges));
    });

    test("posts graphData to webview after restore", async () => {
      const snap = makeSnapshot({ getSnapshot: sinon.stub().resolves({ nodes: [], edges: [] }) });
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(snap);

      await onRestoreSnapshot(makeTask("restore-snapshot", { key: "k" }), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "graphData");
    });
  });

  // ── onUndo ─────────────────────────────────────────────────────────────────

  suite("onUndo", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onUndo(makeTask("undo"), undefined), false);
    });

    test("returns false when session has no snapshots", async () => {
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(makeSnapshot());
      assert.strictEqual(await onUndo(makeTask("undo"), ctx), false);
    });

    test("restores to the snapshot before the latest one", async () => {
      const prev = { key: "snap-1", snapshotPersistedFilePath: "/tmp/1.json", prev: null, next: null as any };
      const latest = { key: "snap-2", snapshotPersistedFilePath: "/tmp/2.json", prev, next: null };
      prev.next = latest;
      const snap = makeSnapshot({
        head: prev,
        tail: latest,
        getSnapshot: sinon.stub().resolves({ nodes: [], edges: [] }),
      });
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(snap);

      await onUndo(makeTask("undo"), ctx);

      const [key] = (snap.getSnapshot as sinon.SinonStub).firstCall.args;
      assert.strictEqual(key, "snap-1");
    });
  });

  // ── onRedo ─────────────────────────────────────────────────────────────────

  suite("onRedo", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onRedo(makeTask("redo"), undefined), false);
    });

    test("returns false when session tail is missing", async () => {
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(makeSnapshot());
      assert.strictEqual(await onRedo(makeTask("redo"), ctx), false);
    });

    test("restores from the tail (most recent) snapshot", async () => {
      const latest = { key: "snap-latest", snapshotPersistedFilePath: "/tmp/l.json", prev: null, next: null };
      const snap = makeSnapshot({
        tail: latest,
        getSnapshot: sinon.stub().resolves({ nodes: [], edges: [] }),
      });
      const ctx = buildCtx();
      (ctx.session.get as sinon.SinonStub).returns(snap);

      await onRedo(makeTask("redo"), ctx);

      const [key] = (snap.getSnapshot as sinon.SinonStub).firstCall.args;
      assert.strictEqual(key, "snap-latest");
    });
  });
});
