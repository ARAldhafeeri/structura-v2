// ── EXPAND NODE ───────────────────────────────────────────────────────────────
// Routes through the engine's onExpandNode processor (GraphState.ts).
// The engine runs BFS on ctx.graph and posts back { command: 'nodesAdded', nodes, edges }
// which is handled by the window.addEventListener('message', ...) listener above.
function buildFullGraph() {
  setMsg('scanning workspace…');
  postToExtension({ command: 'build-full-graph' });
}

function expandNodeImporters(id) {
  const node = getNode(id);
  if (!node) { toast('node not found'); return; }

  const srcEl = state.cy.$id(id);
  if (srcEl.length) {
    const rp = srcEl.renderedPosition();
    const cp = cyPosToContainer(rp);
    spawnParticles(cp.x, cp.y, intentColor[node.intent] || '#00c8ff', 10);
  }

  state.expandingFromId = id;
  postToExtension({ command: 'expand-node-importers', nodeId: id, workspaceRoot: rawData.workspaceRoot });
  setMsg(`finding importers of <strong style="color:var(--accent)">${node.name}</strong>… (scanning workspace)`);
}

function expandNode(id, depth = 1) {
  const node = getNode(id);
  if (!node) { toast('node not found'); return; }
  if (node.metadata?.isExternal) { toast('package import · not explorable'); return; }

  // Particle burst at source for immediate tactile feedback.
  const srcEl = state.cy.$id(id);
  if (srcEl.length) {
    const rp = srcEl.renderedPosition();
    const cp = cyPosToContainer(rp);
    spawnParticles(cp.x, cp.y, intentColor[node.intent] || '#00c8ff', 10);
  }

  // Remember source so nodesAdded handler can animate outward from it.
  state.expandingFromId = id;

  postToExtension({ command: 'expand-node', nodeId: id, depth });
  setMsg(`expanding <strong style="color:var(--accent)">${node.name}</strong>…`);
}

function expandToDepth(targetDepth) {
  const targets = NODES.filter(n => n.depth <= targetDepth && !state.visibleNodeIds.has(n.id));
  if (!targets.length) { toast(`already at depth ${targetDepth}`); return; }

  // Add all nodes at once (invisible), run instant layout, then stagger-reveal.
  targets.forEach(nd => {
    if (state.cy.$id(nd.id).length) return;
    state.visibleNodeIds.add(nd.id);
    const cyData = cyNodeData(nd, false);
    cyData.classes = 'pre-enter';
    state.cy.add(cyData);
  });
  syncEdges();

  runLayout(false, null, false, () => {
    targets.forEach((nd, i) => {
      setTimeout(() => {
        const el = state.cy.$id(nd.id);
        if (!el.length) return;
        el.removeClass('pre-enter');
        el.addClass('new-node');
        setTimeout(() => el.removeClass('new-node'), 500);
      }, i * 35);
    });
    setTimeout(() => {
      saveHistory();
      updateStats();
      updateFileTree();
      state.currentDepth = targetDepth;
      updateDepthIndicator(targetDepth);
      toast(`depth ${targetDepth} · +${targets.length} nodes`);
      state.cy.fit(undefined, 60);
    }, targets.length * 35 + 150);
  });
}

// ── OPEN FILE ─────────────────────────────────────────────────────────────────
function openNodeFile(id) {
  const nd = getNode(id);
  if (!nd) return;
  postToExtension({ command: 'openFile', path: nd.path, line: nd.line || 1 });
}

function togglePin(id) {
  // Route through engine — engine mutates node.metadata.pinned and posts back 'nodePinned'.
  postToExtension({ command: 'pin-node', nodeId: id });
}

function hideNodeFromGraph(id) {
  // Route through engine — engine removes from ctx.graph and posts back 'nodeHidden'.
  postToExtension({ command: 'hide-node', nodeId: id });
}
