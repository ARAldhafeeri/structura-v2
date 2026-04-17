// ── VS CODE API ───────────────────────────────────────────────────────────────
const vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

function postToExtension(msg) {
  if (vscode) vscode.postMessage(msg);
}
