// ── CONTEXT MENU ──────────────────────────────────────────────────────────────
function showCtxMenu(evt, nodeId) {
  const menu = document.getElementById('ctx-menu');
  const nd = getNode(nodeId);
  state.ctxTargetId = nodeId;
  document.getElementById('ctx-title').textContent = nd ? nd.name.toUpperCase() : 'NODE ACTIONS';
  menu.style.display = 'block';
  let x = evt.clientX, y = evt.clientY;
  setTimeout(() => {
    const w = menu.offsetWidth, h = menu.offsetHeight;
    if (x + w > window.innerWidth) x = window.innerWidth - w - 8;
    if (y + h > window.innerHeight) y = window.innerHeight - h - 8;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
  }, 0);
  selectNode(nodeId);
}

function hideCtxMenu() {
  document.getElementById('ctx-menu').style.display = 'none';
  state.ctxTargetId = null;
}

document.getElementById('ctx-expand').addEventListener('click', () => { if (state.ctxTargetId) expandNode(state.ctxTargetId, 1); hideCtxMenu(); });
document.getElementById('ctx-expand-deep').addEventListener('click', () => { if (state.ctxTargetId) expandNode(state.ctxTargetId, 2); hideCtxMenu(); });
document.getElementById('ctx-expand-importers').addEventListener('click', () => { if (state.ctxTargetId) expandNodeImporters(state.ctxTargetId); hideCtxMenu(); });
document.getElementById('ctx-focus').addEventListener('click', () => {
  if (state.ctxTargetId) state.cy.animate({ center: { eles: state.cy.$id(state.ctxTargetId) }, zoom: 2 }, { duration: 300 });
  hideCtxMenu();
});
document.getElementById('ctx-open').addEventListener('click', () => { if (state.ctxTargetId) openNodeFile(state.ctxTargetId); hideCtxMenu(); });
document.getElementById('ctx-pin').addEventListener('click', () => { if (state.ctxTargetId) togglePin(state.ctxTargetId); hideCtxMenu(); });
document.getElementById('ctx-hide').addEventListener('click', () => { if (state.ctxTargetId) hideNodeFromGraph(state.ctxTargetId); hideCtxMenu(); });
document.addEventListener('click', e => { if (!e.target.closest('#ctx-menu')) hideCtxMenu(); });
document.addEventListener('contextmenu', e => { if (e.target.closest('#cy')) e.preventDefault(); });
