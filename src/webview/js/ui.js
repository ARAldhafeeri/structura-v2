// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, duration = 1800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}
function setMsg(html) { document.getElementById('msg').innerHTML = html; }

// ── LOADING OVERLAY ───────────────────────────────────────────────────────────
function hideLoadingOverlay() {
  const el = document.getElementById('loading-overlay');
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 460);
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-nodes').textContent = state.cy.nodes().length;
  document.getElementById('stat-edges').textContent = state.cy.edges().length;
  document.getElementById('stat-depth').textContent = state.currentDepth;
}

function updateDepthIndicator(depth) {
  const arc = document.getElementById('depth-arc');
  document.getElementById('depth-text').textContent = depth;
  const circ = 138;
  arc.setAttribute('stroke-dashoffset', circ - circ * Math.min(depth / 9, 1));
}

// ── FILE TREE ─────────────────────────────────────────────────────────────────
function updateFileTree() {
  const tree = document.getElementById('file-tree');
  const visible = NODES.filter(n => state.visibleNodeIds.has(n.id));
  tree.innerHTML = visible.map((nd, i) => `
    <div class="tree-item ${state.selectedNodeId === nd.id ? 'active' : ''}"
      style="animation-delay:${i * 20}ms"
      data-id="${nd.id}">
      <span class="tree-icon icon-${nd.intent}"></span>
      <span>${nd.name}</span>
    </div>
  `).join('');
  tree.querySelectorAll('.tree-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      selectNode(id);
      state.cy.animate({ center: { eles: state.cy.$id(id) }, zoom: 1.8 }, { duration: 250 });
    });
  });
}

// ── SELECT ───────────────────────────────────────────────────────────────────
function selectNode(id) {
  state.selectedNodeId = id;
  state.cy.elements().unselect();
  const el = state.cy.$id(id);
  el.select();
  state.cy.edges().removeClass('highlighted');
  el.connectedEdges().addClass('highlighted');
  document.getElementById('sel-name').textContent = getNode(id)?.name || id;

  if (el.length) {
    const rp = el.renderedPosition();
    const cp = cyPosToContainer(rp);
    spawnParticles(cp.x, cp.y, intentColor[getNode(id)?.intent] || '#00c8ff', 8);
  }

  showDetailPanel(id);
  updateFileTree();
}

function deselectAll() {
  // Route through engine — engine posts back 'clearSelection'.
  // Also do immediate local UI update so ESC/tap-background feels instant.
  state.selectedNodeId = null;
  state.cy.elements().unselect();
  state.cy.edges().removeClass('highlighted');
  document.getElementById('sel-name').textContent = '—';
  document.getElementById('detail-panel').classList.remove('open');
  updateFileTree();
  postToExtension({ command: 'deselect-all-nodes' });
}

// ── DETAIL PANEL ──────────────────────────────────────────────────────────────
function showDetailPanel(id) {
  const nd = getNode(id);
  if (!nd) return;
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');
  panel.classList.add('open');

  const col = intentColor[nd.intent] || '#888';
  const outgoing = EDGES.filter(e => e.from === id);
  const incoming = EDGES.filter(e => e.to === id);

  function connItem(oid, dir) {
    const other = getNode(oid);
    if (!other) return '';
    const vis = state.visibleNodeIds.has(oid);
    return `<div class="conn-item" data-id="${oid}" data-from="${id}">
      <span class="tree-icon icon-${other.intent}"></span>
      <span>${other.name}</span>
      <span class="conn-arrow">${dir === 'out' ? '→' : '←'}</span>
      ${!vis ? '<span style="font-size:9px;color:var(--text3)">[+]</span>' : ''}
    </div>`;
  }

  content.innerHTML = `
    <div class="detail-node-name">${nd.name}</div>
    <span class="detail-badge" style="background:${col}22;border:1px solid ${col}66;color:${col}">${nd.intent}</span>
    <div class="detail-section-title">Location</div>
    <div class="detail-row"><span class="dkey">path</span><span class="dval">${nd.path}</span></div>
    <div class="detail-row"><span class="dkey">line</span><span class="dval">${nd.line}</span></div>
    <div class="detail-row"><span class="dkey">type</span><span class="dval">${nd.metadata.nodeType}</span></div>
    <div class="detail-section-title">Graph</div>
    <div class="detail-row"><span class="dkey">depth</span><span class="dval">${nd.depth}</span></div>
    <div class="detail-row"><span class="dkey">outgoing</span><span class="dval">${outgoing.length}</span></div>
    <div class="detail-row"><span class="dkey">incoming</span><span class="dval">${incoming.length}</span></div>
    ${outgoing.length ? `<div class="detail-section-title">Imports (${outgoing.length})</div><div>${outgoing.map(e => connItem(e.to, 'out')).join('')}</div>` : ''}
    ${incoming.length ? `<div class="detail-section-title">Imported by (${incoming.length})</div><div>${incoming.map(e => connItem(e.from, 'in')).join('')}</div>` : ''}
    <div class="detail-section-title">Actions</div>
    <div class="conn-item" id="detail-open-file"><span>↗</span><span>Open in editor</span></div>
    <div class="conn-item" id="detail-expand"><span>⊕</span><span>Expand neighbors</span></div>
    <div class="conn-item" id="detail-expand-importers"><span>⇑</span><span>Who imports this</span></div>
  `;

  // Wire connection items (click to jump-or-expand)
  content.querySelectorAll('.conn-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      const oid = el.dataset.id;
      const fromId = el.dataset.from;
      if (state.visibleNodeIds.has(oid)) {
        selectNode(oid);
        state.cy.animate({ center: { eles: state.cy.$id(oid) }, zoom: 1.5 }, { duration: 300 });
      } else {
        expandNode(fromId, 1);
        setTimeout(() => { if (state.visibleNodeIds.has(oid)) selectNode(oid); }, 700);
      }
    });
  });

  document.getElementById('detail-open-file')?.addEventListener('click', () => openNodeFile(id));
  document.getElementById('detail-expand')?.addEventListener('click', () => expandNode(id, 1));
  document.getElementById('detail-expand-importers')?.addEventListener('click', () => expandNodeImporters(id));
}
