// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────────
function cycleNodes(dir) {
  const ids = state.cy.nodes().map(n => n.id());
  if (!ids.length) return;
  if (!state.selectedNodeId) { selectNode(ids[0]); return; }
  const idx = ids.indexOf(state.selectedNodeId);
  const next = ids[(idx + dir + ids.length) % ids.length];
  selectNode(next);
  state.cy.animate({ center: { eles: state.cy.$id(next) }, zoom: Math.max(state.cy.zoom(), 1.2) }, { duration: 200 });
}

function navigateDir(dir) {
  const nodes = state.cy.nodes();
  if (!nodes.length) return;
  if (!state.selectedNodeId) { selectNode(nodes[0].id()); return; }
  const cur = state.cy.$id(state.selectedNodeId);
  if (!cur.length) return;
  const pos = cur.renderedPosition();
  let best = null, bestDist = Infinity;
  nodes.forEach(n => {
    if (n.id() === state.selectedNodeId) return;
    const np = n.renderedPosition();
    const dx = np.x - pos.x, dy = np.y - pos.y;
    let valid = false;
    if (dir === 'up'    && dy < -10 && Math.abs(dx) < Math.abs(dy) * 1.8) valid = true;
    if (dir === 'down'  && dy >  10 && Math.abs(dx) < Math.abs(dy) * 1.8) valid = true;
    if (dir === 'left'  && dx < -10 && Math.abs(dy) < Math.abs(dx) * 1.8) valid = true;
    if (dir === 'right' && dx >  10 && Math.abs(dy) < Math.abs(dx) * 1.8) valid = true;
    if (valid) { const dist = Math.sqrt(dx*dx+dy*dy); if (dist < bestDist) { bestDist = dist; best = n; } }
  });
  if (best) { selectNode(best.id()); state.cy.animate({ center: { eles: best }, zoom: Math.max(state.cy.zoom(), 1.1) }, { duration: 180 }); }
}

// ── KBD HELP ──────────────────────────────────────────────────────────────────
function toggleKbdHelp() { document.getElementById('kbd-help').classList.toggle('show'); }

document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const { key, altKey, shiftKey, ctrlKey, metaKey } = e;
  const alt = altKey;
  const ctrl = ctrlKey || metaKey;

  if (key === '?' || (shiftKey && key === '/')) { e.preventDefault(); toggleKbdHelp(); return; }

  if (key === 'Escape') {
    e.preventDefault();
    if (document.getElementById('kbd-help').classList.contains('show')) {
      document.getElementById('kbd-help').classList.remove('show');
    } else { deselectAll(); }
    return;
  }

  if (key === ' ' && !alt && !ctrl) { e.preventDefault(); state.cy.fit(undefined, 60); toast('view fitted'); return; }

  if (key === 'Tab' && !alt && !ctrl) { e.preventDefault(); cycleNodes(shiftKey ? -1 : 1); return; }

  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key) && !alt && !ctrl) {
    e.preventDefault();
    navigateDir({ ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }[key]);
    return;
  }

  // Enter = open file in editor
  if (key === 'Enter' && !alt && !ctrl) {
    e.preventDefault();
    if (state.selectedNodeId) openNodeFile(state.selectedNodeId);
    else toast('select a node first');
    return;
  }

  // 1-9 = expand to depth N
  if (key >= '1' && key <= '9' && !alt && !ctrl && !shiftKey) { e.preventDefault(); expandToDepth(parseInt(key)); return; }

  if (ctrl && alt && key === 'e') { e.preventDefault(); if (state.selectedNodeId) expandNode(state.selectedNodeId, 1); else toast('select a node first'); return; }
  if (ctrl && alt && key === 'd') { e.preventDefault(); if (state.selectedNodeId) expandNode(state.selectedNodeId, 2); else toast('select a node first'); return; }
  if (ctrl && alt && key === 'f') {
    e.preventDefault();
    if (state.selectedNodeId) state.cy.animate({ center: { eles: state.cy.$id(state.selectedNodeId) }, zoom: 2 }, { duration: 300 });
    else state.cy.fit(undefined, 60);
    return;
  }
  if (ctrl && alt && key === 'u') { e.preventDefault(); if (state.selectedNodeId) expandNodeImporters(state.selectedNodeId); else toast('select a node first'); return; }
  if (ctrl && alt && key === 'w') { e.preventDefault(); buildFullGraph(); return; }
  if (ctrl && alt && key === 'p') { e.preventDefault(); if (state.selectedNodeId) togglePin(state.selectedNodeId); else toast('select a node first'); return; }
  if (ctrl && alt && key === 'h') { e.preventDefault(); if (state.selectedNodeId) hideNodeFromGraph(state.selectedNodeId); else toast('select a node first'); return; }
  if (ctrl && alt && key === '[') { e.preventDefault(); travelHistory(-1); return; }
  if (ctrl && alt && key === ']') { e.preventDefault(); travelHistory(1); return; }
});

document.getElementById('kbd-close').addEventListener('click', () => document.getElementById('kbd-help').classList.remove('show'));
document.getElementById('kbd-help').addEventListener('click', e => { if (e.target === document.getElementById('kbd-help')) document.getElementById('kbd-help').classList.remove('show'); });
