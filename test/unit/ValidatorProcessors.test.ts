import * as assert from "assert";
import sinon from "sinon";
import {
  onUpdateSettings,
  onLoadSettings,
} from "../../src/core/processors/Validator.js";
import { buildCtx, makeTask } from "./helpers.js";

suite("Processor — Validator", () => {
  teardown(() => sinon.restore());

  // ── onUpdateSettings ───────────────────────────────────────────────────────

  suite("onUpdateSettings", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onUpdateSettings(makeTask("update-settings", { updates: {} }), undefined), false);
    });

    test("calls settings.set for each key in updates", async () => {
      const ctx = buildCtx();
      const updates = { "structura.depth": 2, "structura.ignore": ["node_modules"] };

      await onUpdateSettings(makeTask("update-settings", { updates }), ctx);

      assert.ok((ctx.settings.set as sinon.SinonStub).calledWith("structura.depth", 2));
      assert.ok((ctx.settings.set as sinon.SinonStub).calledWith("structura.ignore", ["node_modules"]));
      assert.strictEqual((ctx.settings.set as sinon.SinonStub).callCount, 2);
    });

    test("does nothing when updates is empty", async () => {
      const ctx = buildCtx();
      await onUpdateSettings(makeTask("update-settings", { updates: {} }), ctx);
      assert.ok((ctx.settings.set as sinon.SinonStub).notCalled);
    });

    test("returns true on success", async () => {
      const ctx = buildCtx();
      assert.strictEqual(await onUpdateSettings(makeTask("update-settings"), ctx), true);
    });
  });

  // ── onLoadSettings ─────────────────────────────────────────────────────────

  suite("onLoadSettings", () => {
    test("returns false when ctx is undefined", async () => {
      assert.strictEqual(await onLoadSettings(makeTask("load-settings"), undefined), false);
    });

    test("calls settings.getAll()", async () => {
      const ctx = buildCtx();
      await onLoadSettings(makeTask("load-settings"), ctx);
      assert.ok((ctx.settings.getAll as sinon.SinonStub).calledOnce);
    });

    test("posts settingsLoaded to webview with all settings", async () => {
      const allSettings = { "structura.depth": 1, "structura.ignore": ["node_modules"] };
      const ctx = buildCtx();
      (ctx.settings.getAll as sinon.SinonStub).returns(allSettings);

      await onLoadSettings(makeTask("load-settings"), ctx);

      const msg = (ctx.webview!.postMessage as sinon.SinonStub).firstCall.args[0];
      assert.strictEqual(msg.command, "settingsLoaded");
      assert.deepStrictEqual(msg.settings, allSettings);
    });

    test("returns true on success", async () => {
      assert.strictEqual(await onLoadSettings(makeTask("load-settings"), buildCtx()), true);
    });
  });
});
