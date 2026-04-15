import * as assert from "assert";
import sinon from "sinon";
import { WebviewPanelController } from "../../src/core/WebviewController.js";
import type { GraphPanel } from "../../src/graphPanel.js";

/** Minimal GraphPanel stub — only the methods WebviewPanelController touches. */
function makePanel(): GraphPanel {
  return {
    postToWebview: sinon.stub(),
  } as unknown as GraphPanel;
}

suite("WebviewPanelController", () => {
  teardown(() => sinon.restore());

  test("postMessage delegates to panel.postToWebview", () => {
    const panel = makePanel();
    const controller = new WebviewPanelController(panel);
    const msg = { command: "graphData", nodes: [], edges: [] };

    controller.postMessage(msg);

    assert.ok(
      (panel.postToWebview as sinon.SinonStub).calledOnceWithExactly(msg),
      "postToWebview must be called with the same message object",
    );
  });

  test("postMessage forwards any shape of message", () => {
    const panel = makePanel();
    const controller = new WebviewPanelController(panel);

    controller.postMessage({ command: "highlight", nodeIds: ["a"], color: "red" });

    const arg = (panel.postToWebview as sinon.SinonStub).firstCall.args[0];
    assert.strictEqual(arg.command, "highlight");
    assert.deepStrictEqual(arg.nodeIds, ["a"]);
  });

  test("onMessage does not throw", () => {
    const controller = new WebviewPanelController(makePanel());
    assert.doesNotThrow(() => controller.onMessage(() => {}));
  });

  test("show does not throw", () => {
    const controller = new WebviewPanelController(makePanel());
    assert.doesNotThrow(() => controller.show());
  });

  test("hide does not throw", () => {
    const controller = new WebviewPanelController(makePanel());
    assert.doesNotThrow(() => controller.hide());
  });

  test("isVisible returns false", () => {
    const controller = new WebviewPanelController(makePanel());
    assert.strictEqual(controller.isVisible(), false);
  });

  test("multiple postMessage calls each reach the panel", () => {
    const panel = makePanel();
    const controller = new WebviewPanelController(panel);

    controller.postMessage({ command: "a" });
    controller.postMessage({ command: "b" });
    controller.postMessage({ command: "c" });

    assert.strictEqual((panel.postToWebview as sinon.SinonStub).callCount, 3);
  });
});
