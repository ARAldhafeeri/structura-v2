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

  // ── PARENT-DRAG: children move with their parent ──────────────────────────
  // When a node is grabbed, record all visible descendants' start positions.
  // On each drag tick, translate them by the same delta as the parent.
  let _drag = null;

  state.cy.on('grab', 'node', e => {
    const parentEl = e.target;
    const desc = _getVisibleDescendants(parentEl.id());
    if (!desc.length) { _drag = null; return; }
    _drag = {
      id: parentEl.id(),
      px: parentEl.position().x,
      py: parentEl.position().y,
      children: desc.map(id => ({
        id,
        ox: state.cy.$id(id).position().x,
        oy: state.cy.$id(id).position().y,
      })),
    };
  });

  state.cy.on('drag', 'node', e => {
    if (!_drag || _drag.id !== e.target.id()) return;
    const pos = e.target.position();
    const dx = pos.x - _drag.px;
    const dy = pos.y - _drag.py;
    _drag.children.forEach(c => {
      state.cy.$id(c.id).position({ x: c.ox + dx, y: c.oy + dy });
    });
  });

  state.cy.on('free', 'node', () => { _drag = null; });
}

// ── NODE / EDGE BUILDERS ──────────────────────────────────────────────────────
function cyNodeData(nd, animate) {
  const sz = 14 + Math.min((nd.weight / 100) * 22, 22);
  return {
    group: 'nodes',
    data: {
      id: nd.id, label: nd.name, color: intentColor[nd.intent] || '#888',
      size: sz, weight: nd.weight, intent: nd.intent,
      nodeType: nd.metadata?.nodeType || 'unknown',  // used by legend filter
    },
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

  // For incremental updates, use a faster layout
  const base = n <= 4 ? {
    name: 'concentric',
    concentric: node => node.data('weight'),
    levelWidth: () => 3,
    minNodeSpacing: 80,
    padding: 80,
  } : {
    name: 'cose',
    randomize: false,
    nodeRepulsion: () => 4000, // Reduced for better incremental updates
    edgeElasticity: () => 100,
    gravity: 0.25,
    nestingFactor: 1.0,
    componentSpacing: 50,
    coolingFactor: 0.95,
    initialTemp: 200, // Lower temp for incremental updates
    fit,
    padding: 60,
    // Important: don't animate if we're doing custom animations
    animate: false, // Always false - we handle animations separately
  };

  const opts = {
    ...base,
    animate: false, // Disable built-in animation
  };

  const layout = state.cy.layout(opts);

  if (onDone) layout.one('layoutstop', onDone);
  if (focusId) layout.one('layoutstop', () => {
    const el = state.cy.$id(focusId);
    if (el.length) {
      state.cy.animate({ 
        center: { eles: el }, 
        zoom: Math.max(state.cy.zoom(), 1.3) 
      }, { duration: 280 });
    }
  });

  layout.run();
}

// ── ANTI-OVERLAP PASS ─────────────────────────────────────────────────────────
// Runs a low-temperature cose pass after node expansion to gently push
// overlapping nodes apart without reorganising the overall graph structure.
// Uses randomize:false so only small nudges are applied from current positions.
function runAntiOverlap(onDone = null) {
  if (!state.cy || state.cy.nodes(':visible').length < 2) { if (onDone) onDone(); return; }

  const layout = state.cy.layout({
    name: 'cose',
    randomize: false,       // start from current positions — preserves structure
    fit: false,             // don't jump the viewport
    padding: 60,
    animate: true,
    animationDuration: 500,
    nodeRepulsion: () => 6000,
    nodeOverlap: 40,        // high penalty pushes overlapping nodes apart aggressively
    edgeElasticity: () => 50,
    gravity: 0.1,
    coolingFactor: 0.99,
    initialTemp: 60,        // low temp → small corrections only, no big jumps
  });

  if (onDone) layout.one('layoutstop', onDone);
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
  if (!cyFrom.length || !cyTo.length) return;
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

// ── LEGEND / NODE-TYPE FILTER ─────────────────────────────────────────────────
// Categories ordered large → small; unchecked ones are hidden by default.
const LEGEND_CATEGORIES = [
  { id: 'files',        label: 'Files',            color: '#00c8ff', checked: true,
    types: new Set(['Program']) },
  { id: 'declarations', label: 'Classes & Types',   color: '#f0c040', checked: true,
    types: new Set(['ClassDeclaration', 'TSInterfaceDeclaration', 'TSEnumDeclaration',
                    'TSTypeAliasDeclaration', 'TSModuleDeclaration']) },
  { id: 'functions',    label: 'Functions',         color: '#00c8ff', checked: true,
    types: new Set(['FunctionDeclaration', 'MethodDefinition', 'GeneratorFunction']) },
  { id: 'imports',      label: 'Imports & Exports', color: '#00ffb2', checked: true,
    types: new Set(['ImportDeclaration', 'ExportNamedDeclaration', 'ExportDefaultDeclaration',
                    'ExportAllDeclaration', 'TSExportAssignment', 'TSImportEqualsDeclaration']) },
  { id: 'members',      label: 'Members & Fields',  color: '#00c8ff', checked: false,
    types: new Set(['PropertyDefinition', 'StaticBlock', 'TSMethodSignature',
                    'TSPropertySignature', 'TSEnumMember', 'TSConstructSignatureDeclaration',
                    'TSCallSignatureDeclaration', 'TSIndexSignature']) },
  { id: 'control-flow', label: 'Control Flow',      color: '#806050', checked: false,
    types: new Set(['IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
                    'WhileStatement', 'DoWhileStatement', 'SwitchStatement', 'TryStatement']) },
  { id: 'calls',        label: 'Calls',             color: '#7b2fff', checked: false,
    types: new Set(['NewExpression', 'AwaitExpression', 'YieldExpression',
                    'TaggedTemplateExpression', 'MemberExpression', 'ConditionalExpression',
                    'Decorator', 'JSXOpeningElement', 'JSXFragment', 'JSXSpreadAttribute']) },
  { id: 'variables',    label: 'Variables',         color: '#ff6b35', checked: false,
    types: new Set(['VariableDeclarator', 'AssignmentExpression',
                    'ObjectPattern', 'ArrayPattern', 'RestElement', 'AssignmentPattern']) },
];

// Reverse-lookup: nodeType → category object
const _typeToCat = new Map();
LEGEND_CATEGORIES.forEach(cat => cat.types.forEach(t => _typeToCat.set(t, cat)));

function isTypeHidden(nodeType) {
  const cat = _typeToCat.get(nodeType);
  return cat ? !cat.checked : false;
}

/**
 * Apply legend filter to all cy nodes and their incident edges.
 * Nodes whose category is unchecked get display:none (excluded from layout).
 * Called after any batch of nodes/edges is added to cy.
 */
function applyLegendFilter() {
  if (!state.cy) return;
  state.cy.batch(() => {
    state.cy.nodes().forEach(node => {
      node.style('display', isTypeHidden(node.data('nodeType')) ? 'none' : 'element');
    });
    state.cy.edges().forEach(edge => {
      const srcHidden = isTypeHidden(state.cy.$id(edge.data('source')).data('nodeType'));
      const tgtHidden = isTypeHidden(state.cy.$id(edge.data('target')).data('nodeType'));
      edge.style('display', (srcHidden || tgtHidden) ? 'none' : 'element');
    });
  });
}

/**
 * Build the legend UI and wire checkbox change → applyLegendFilter.
 * Called once during init.
 */
function buildLegendUI() {
  const legend = document.getElementById('legend');
  legend.innerHTML =
    `<div class="legend-title">Filter Nodes</div>` +
    `<div class="legend-sep-line"></div>` +
    LEGEND_CATEGORIES.map(cat =>
      `<label class="legend-check" data-cat="${cat.id}">
        <input type="checkbox" id="legend-${cat.id}"${cat.checked ? ' checked' : ''}>
        <span class="legend-dot" style="background:${cat.color};box-shadow:0 0 5px ${cat.color}88"></span>
        <span class="legend-label">${cat.label}</span>
      </label>`
    ).join('');

  legend.querySelectorAll('.legend-check input').forEach(cb => {
    cb.addEventListener('change', () => {
      const cat = LEGEND_CATEGORIES.find(c => c.id === cb.closest('[data-cat]').dataset.cat);
      if (!cat) return;
      cat.checked = cb.checked;
      if (cb.checked) {
        // Ask the backend to find and deliver nodes of this category whose
        // parent is already visible. The response arrives as 'nodesAdded'.
        postToExtension({
          command: 'expand-category',
          nodeTypes: [...cat.types],
          visibleNodeIds: [...state.visibleNodeIds],
        });
      } else {
        // Remove all cy nodes of this category and their incident edges.
        state.cy.batch(() => {
          state.cy.nodes().forEach(node => {
            if (cat.types.has(node.data('nodeType'))) {
              state.visibleNodeIds.delete(node.id());
              state.cy.remove(node);
            }
          });
        });
        updateStats();
        updateFileTree();
      }
    });
  });
}

// ── PARENT-DRAG HELPERS ───────────────────────────────────────────────────────
/**
 * BFS through contains-edges (weight === 1) from nodeId,
 * returning the IDs of all visible descendants currently in cy.
 */
function _getVisibleDescendants(nodeId) {
  // Build adjacency for this traversal from the live EDGES array.
  const adj = new Map();
  EDGES.forEach(e => {
    if (e.weight === 1) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e.to);
    }
  });
  const result = [];
  const seen = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    for (const child of (adj.get(cur) || [])) {
      if (seen.has(child)) continue;
      seen.add(child);
      const el = state.cy.$id(child);
      if (el.length && el.style('display') !== 'none') {
        result.push(child);
        queue.push(child);
      }
    }
  }
  return result;
}
