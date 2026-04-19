// ── VS CODE API ───────────────────────────────────────────────────────────────
const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

console.log("[structura:webview]", "vs code intialized ", typeof vscode)
function postToExtension(msg) {
  console.log("[structura:webview]","message sent through post message apis ", msg)

  if (vscode) vscode.postMessage(msg);
}
