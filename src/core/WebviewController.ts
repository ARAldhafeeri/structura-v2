import type { IWebviewController } from "../contract/ViewPort.js";
import type { GraphPanel } from "../graphPanel.js";

/**
 * Adapts GraphPanel to the IWebviewController interface expected by
 * IProcessorContext.webview so that processor handlers can post messages
 * to the VS Code webview panel without depending on GraphPanel directly.
 */
export class WebviewPanelController implements IWebviewController {
  constructor(private readonly panel: GraphPanel) {}

  postMessage(message: unknown): void {
    this.panel.postToWebview(message);
  }

  /**
   * GraphPanel handles inbound webview messages internally in show().
   * This hook is a no-op for v1 — processors that need to react to webview
   * events should be triggered via the PriorityTaskQueue instead.
   */
  onMessage(_callback: (message: unknown) => void): void {
    // intentional no-op for v1
  }

  show(): void {
    // GraphPanel manages its own reveal; no-op here.
  }

  hide(): void {
    // WebviewPanel does not expose a hide API; no-op.
  }

  isVisible(): boolean {
    return false;
  }
}
