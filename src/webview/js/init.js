// ── ANIMATED GRID ─────────────────────────────────────────────────────────────
let gridOffset = 0;
function animateGrid() {
  gridOffset = (gridOffset + 0.08) % 40;
  document.getElementById('cy-bg').style.backgroundPosition = `${gridOffset}px ${gridOffset}px`;
  requestAnimationFrame(animateGrid);
}

// ── SEED GRAPH ───────────────────────────────────────────────────────────────
// Strategy: add seed nodes invisible → run layout with animate:false (instant,
// no jumps) → stagger-fade each node in at its final position → hide overlay.
function seedGraph() {
  if (!NODES.length) {
    document.getElementById('empty-state').classList.add('show');
    hideLoadingOverlay();
    return;
  }

  // Show the active file and its depth-1 and depth-2 neighbours on initial load.
  // This gives the developer an immediate view of the file they opened and its context.
  const initialNodes = NODES.filter(n => n.depth <= 2 && n.depth >= 0);
  const toShow = initialNodes.length ? initialNodes : NODES.filter(n => n.seed);

  // Add all initial nodes with pre-enter class (invisible) so layout runs before reveal.
  toShow.forEach(n => {
    if (state.cy.$id(n.id).length) return;
    state.visibleNodeIds.add(n.id);
    const cyData = cyNodeData(n, false);
    cyData.classes = (cyData.classes ? cyData.classes + ' ' : '') + 'pre-enter';
    state.cy.add(cyData);
  });

  syncEdges();
  applyLegendFilter(); // hide unchecked-category nodes before layout so they don't affect positioning

  // Run layout instantly (animate:false) — nodes reach final positions synchronously.
  // onDone is passed so the callback is registered BEFORE layout.run() fires layoutstop.
  runLayout(true, null, false, () => {
    // Stagger-reveal each node from its already-stable position.
    const cyNodes = state.cy.nodes('.pre-enter');
    cyNodes.forEach((el, i) => {
      setTimeout(() => {
        el.removeClass('pre-enter');
        el.addClass('new-node');
        setTimeout(() => el.removeClass('new-node'), 500);
      }, i * 70);
    });

    const revealDuration = cyNodes.length * 70 + 200;
    setTimeout(() => {
      hideLoadingOverlay();
      state.cy.fit(undefined, 70);
    }, revealDuration);

    const shownDepth = toShow.reduce((max, n) => Math.max(max, n.depth), 0);
    state.currentDepth = shownDepth;
    saveHistory();
    updateFileTree();
    updateStats();
    updateDepthIndicator(shownDepth);
    document.getElementById('stat-total').textContent = NODES.length;
    const wsName = rawData.workspaceRoot
      ? rawData.workspaceRoot.replace(/\\/g, '/').split('/').pop()
      : (rawData.nodes[0]?.path?.replace(/\\/g, '/').split('/').slice(-3, -2)[0] || 'workspace');
    document.getElementById('workspace-path').textContent = wsName;
    setMsg('graph ready · <strong style="color:var(--accent)">Ctrl+Alt+E</strong> expand · <strong style="color:var(--accent)">Tab</strong> navigate · <strong style="color:var(--accent)">?</strong> help');
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
animateParticles();
initCy();
buildLegendUI();   // build checkbox legend before any nodes arrive
animateGrid();

// Small delay lets Cytoscape finish mounting before we add nodes.
setTimeout(() => seedGraph(), 150);
