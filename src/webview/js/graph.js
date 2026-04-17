// ── CYTOSCAPE ────────────────────────────────────────────────────────────────
function initCy() {
  state.cy = cytoscape({
    container: document.getElementById('cy'),
    elements: [],
    style: [
      { selector: 'node', style: {
        'width': 'data(size)', 'height': 'data(size)',
        'background-color': 'data(color)', 'background-opacity': 0.15,
        'border-color': 'data(color)', 'border-width': 1.5, 'border-opacity': 0.85,
        'label': 'data(label)', 'color': '#c8daf0', 'font-size': 10,
        'font-family': 'JetBrains Mono, Cascadia Code, Consolas, monospace',
        'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 4,
        'text-opacity': 0.8, 'min-zoomed-font-size': 8, 'shape': 'ellipse',
        'shadow-blur': 12, 'shadow-color': 'data(color)', 'shadow-opacity': 0.4,
        'shadow-offset-x': 0, 'shadow-offset-y': 0,
        'transition-property': 'background-opacity, border-opacity, shadow-opacity, width, height',
        'transition-duration': '0.25s',
      }},
      { selector: 'node:selected', style: {
        'background-opacity': 0.35, 'border-width': 2.5, 'border-opacity': 1,
        'shadow-opacity': 0.8, 'shadow-blur': 28, 'text-opacity': 1, 'color': '#ffffff',
      }},
      { selector: 'node.pinned', style: { 'shape': 'diamond', 'border-style': 'dashed' }},
      { selector: 'node.seed', style: { 'shape': 'hexagon', 'border-width': 2.5, 'background-opacity': 0.25 }},
      { selector: 'node.new-node', style: { 'background-opacity': 0.6, 'border-opacity': 1, 'shadow-opacity': 1, 'shadow-blur': 40 }},
      { selector: 'node.pre-enter', style: { 'background-opacity': 0, 'border-opacity': 0, 'text-opacity': 0, 'shadow-opacity': 0 }},
      { selector: 'edge', style: {
        'width': 'data(weight)', 'line-color': 'data(edgeColor)', 'line-opacity': 0.35,
        'target-arrow-color': 'data(edgeColor)', 'target-arrow-shape': 'triangle',
        'arrow-scale': 0.7, 'curve-style': 'bezier', 'target-arrow-opacity': 0.5,
        'transition-property': 'line-opacity, target-arrow-opacity', 'transition-duration': '0.2s',
      }},
      { selector: 'edge.highlighted', style: { 'line-opacity': 0.85, 'target-arrow-opacity': 1, 'width': 2, 'z-index': 10 }},
      { selector: 'edge.new-edge', style: { 'line-opacity': 0.8, 'target-arrow-opacity': 0.9 }},
      { selector: '.dimmed', style: { 'opacity': 0.15 }},
    ],
    layout: { name: 'preset' },
    wheelSensitivity: 0.3,
    minZoom: 0.1,
    maxZoom: 4,
  });

  state.cy.on('tap', 'node', e => selectNode(e.target.id()));
  state.cy.on('tap', e => { if (e.target === state.cy) deselectAll(); });
  state.cy.on('cxttap', 'node', e => { e.originalEvent.preventDefault(); showCtxMenu(e.originalEvent, e.target.id()); });
  state.cy.on('dbltap', 'node', e => expandNode(e.target.id()));
  state.cy.on('mouseover', 'node', e => {
    const id = e.target.id();
    const neighbors = new Set(getNeighborIds(id));
    neighbors.add(id);
    state.cy.elements().forEach(el => { if (!neighbors.has(el.id()) && !el.isEdge()) el.addClass('dimmed'); });
    state.cy.edges().forEach(edge => { if (edge.data('source') !== id && edge.data('target') !== id) edge.addClass('dimmed'); });
  });
  state.cy.on('mouseout', 'node', () => state.cy.elements().removeClass('dimmed'));
}

// ── NODE / EDGE BUILDERS ──────────────────────────────────────────────────────
function cyNodeData(nd, animate) {
  const sz = 14 + Math.min((nd.weight / 100) * 22, 22);
  return {
    group: 'nodes',
    data: { id: nd.id, label: nd.name, color: intentColor[nd.intent] || '#888', size: sz, weight: nd.weight, intent: nd.intent },
    classes: [nd.seed ? 'seed' : '', animate ? 'new-node' : ''].filter(Boolean).join(' '),
  };
}

function cyEdgeData(edge) {
  const fromNode = getNode(edge.from);
  const col = fromNode ? (intentColor[fromNode.intent] || '#888') : '#888';
  return {
    group: 'edges',
    data: { id: `${edge.from}__${edge.to}`, source: edge.from, target: edge.to,
      weight: Math.min(edge.weight * 0.6 + 0.4, 2), edgeColor: col },
  };
}

// ── LAYOUT ───────────────────────────────────────────────────────────────────
// animate=false: instant positioning — onDone fires after stable positions set
// animate=true : visible transition — onDone fires after animation completes
// onDone is attached BEFORE layout.run() so it catches synchronous layoutstop.
function runLayout(fit = false, focusId = null, animate = true, onDone = null) {
  const n = state.cy.nodes().length;
  if (n === 0) { if (onDone) onDone(); return; }

  const base = n <= 4 ? {
    name: 'concentric',
    concentric: node => node.data('weight'),
    levelWidth: () => 3,
    minNodeSpacing: 80,
    padding: 80,
  } : {
    name: 'cose',
    randomize: false,
    nodeRepulsion: () => 9000,
    edgeElasticity: () => 120,
    gravity: 0.2,
    nestingFactor: 1.1,
    componentSpacing: 60,
    coolingFactor: 0.97,
    initialTemp: 350,
    fit,
    padding: 70,
  };

  const opts = {
    ...base,
    animate,
    animationDuration: animate ? (n <= 4 ? 450 : 550) : 0,
    animationEasing: 'ease-in-out-cubic',
  };

  const layout = state.cy.layout(opts);

  // Attach callbacks BEFORE run() — critical for animate:false (synchronous layoutstop).
  if (onDone)   layout.one('layoutstop', onDone);
  if (focusId)  layout.one('layoutstop', () => {
    const el = state.cy.$id(focusId);
    if (el.length) state.cy.animate({ center: { eles: el }, zoom: Math.max(state.cy.zoom(), 1.3) }, { duration: 280 });
  });

  layout.run();
}

// ── ADD NODES / EDGES ─────────────────────────────────────────────────────────
// Adds a node to Cytoscape. Does NOT update DOM panels — callers must batch those.
function addNodeToGraph(nd, animate = true) {
  if (state.cy.$id(nd.id).length) return;
  state.visibleNodeIds.add(nd.id);
  const cyData = cyNodeData(nd, animate);
  state.cy.add(cyData);
  if (animate) setTimeout(() => state.cy.$id(nd.id).removeClass('new-node'), 600);
}

function addEdgeToGraph(edge) {
  const eid = `${edge.from}__${edge.to}`;
  if (state.cy.$id(eid).length) { return; } // already exists
  const cyFrom = state.cy.$id(edge.from);
  const cyTo   = state.cy.$id(edge.to);
  if (!cyFrom.length || !cyTo.length) {
    console.warn('[Stractura] addEdgeToGraph — cy node missing! from:', edge.from, '(found:', cyFrom.length, ') to:', edge.to, '(found:', cyTo.length, ')');
    return;
  }
  console.log('[Stractura] adding edge:', edge.from, '→', edge.to);
  const el = state.cy.add(cyEdgeData(edge));
  el.addClass('new-edge');
  setTimeout(() => el.removeClass('new-edge'), 400);
}

function syncEdges() {
  let added = 0, skippedBothMissing = 0, skippedFromMissing = 0, skippedToMissing = 0;
  EDGES.forEach(e => {
    const hasFrom = state.visibleNodeIds.has(e.from);
    const hasTo = state.visibleNodeIds.has(e.to);
    if (hasFrom && hasTo) { addEdgeToGraph(e); added++; }
    else if (!hasFrom && !hasTo) skippedBothMissing++;
    else if (!hasFrom) skippedFromMissing++;
    else skippedToMissing++;
  });
  console.log(`[Stractura] syncEdges — added:${added} skipped(bothMissing:${skippedBothMissing} fromMissing:${skippedFromMissing} toMissing:${skippedToMissing}) cy-edges:${state.cy.edges().length}`);
}
