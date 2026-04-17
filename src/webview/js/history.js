// ── HISTORY ───────────────────────────────────────────────────────────────────
function saveHistory() {
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push([...state.visibleNodeIds]);
  state.historyIndex = state.history.length - 1;
  updateHistoryBar();
}

function travelHistory(dir) {
  const newIdx = state.historyIndex + dir;
  if (newIdx < 0 || newIdx >= state.history.length) { toast(dir < 0 ? 'at beginning' : 'at end'); return; }
  state.historyIndex = newIdx;
  const snapshot = state.history[newIdx];

  // Remove nodes not in snapshot.
  state.cy.nodes().forEach(n => {
    if (!snapshot.includes(n.id())) { state.cy.remove(n); state.visibleNodeIds.delete(n.id()); }
  });

  // Add missing nodes (invisible first).
  snapshot.forEach(id => {
    if (!state.visibleNodeIds.has(id)) {
      const nd = getNode(id);
      if (!nd) return;
      state.visibleNodeIds.add(id);
      const cyData = cyNodeData(nd, false);
      cyData.classes = 'pre-enter';
      state.cy.add(cyData);
    }
  });
  syncEdges();

  runLayout(false, null, false, () => {
    state.cy.nodes('.pre-enter').forEach((el, i) => {
      setTimeout(() => {
        el.removeClass('pre-enter');
        el.addClass('new-node');
        setTimeout(() => el.removeClass('new-node'), 500);
      }, i * 40);
    });
    updateHistoryBar();
    updateStats();
    updateFileTree();
    toast(dir < 0 ? 'time travel back' : 'time travel forward');
  });
}

function updateHistoryBar() {
  const bar = document.getElementById('history-bar');
  bar.innerHTML = state.history.map((snap, i) => `
    <span class="history-step ${i === state.historyIndex ? 'current' : ''}" data-idx="${i}">
      ${i > 0 ? '<span style="color:var(--border2)">›</span>' : ''}s${i+1}(${snap.length})
    </span>
  `).join('');
  bar.querySelectorAll('.history-step').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const diff = idx - state.historyIndex;
      if (diff !== 0) for (let i = 0; i < Math.abs(diff); i++) travelHistory(diff > 0 ? 1 : -1);
    });
  });
}
