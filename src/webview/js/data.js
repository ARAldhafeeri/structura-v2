// ── DECODE NODE PATH FROM ID ──────────────────────────────────────────────────
// SemanticNode ids are encoded: encodedAbsPath:line:col:nodeType
// colons in path are encoded as %3A by makeId() in uitlities/parser.ts
function extractPathFromId(id) {
  const match = id.match(/^(.+):(\d+):(\d+):[^:]+$/);
  if (!match) return id;
  return match[1].replace(/%3A/g, ':');
}

// ── DATA FROM EXTENSION ──────────────────────────────────────────────────────
const rawData = window.__STRACTURA_INITIAL_DATA__ || { nodes: [], edges: [], workspaceRoot: '' };

// [DEBUG] Inspect raw data coming from the engine
console.log('[Stractura] rawData.nodes.length =', rawData.nodes.length);
console.log('[Stractura] rawData.edges.length =', rawData.edges.length);
console.log('[Stractura] rawData.workspaceRoot =', rawData.workspaceRoot);
console.log('[Stractura] rawData.nodes sample (first 5):', JSON.stringify(rawData.nodes.slice(0, 5), null, 2));
console.log('[Stractura] rawData.edges sample (first 5):', JSON.stringify(rawData.edges.slice(0, 5), null, 2));

/**
 * Resolve a human-readable display name for a semantic node.
 * Program nodes (file-level roots) show their filename instead of "module".
 */
function resolveDisplayName(n) {
  const fallback = n.id.split(':').pop() || 'node';
  if (n.metadata?.nodeType === 'Program') {
    const p = n.path || extractPathFromId(n.id);
    // Extract just the filename component of the path
    const filename = p.replace(/\\/g, '/').split('/').pop();
    return filename || fallback;
  }
  return n.name || fallback;
}

// Convert a SemanticNode (from engine) into the display node format used by Cytoscape.
// Must stay in sync with the NODES mapping below.
function toDisplayNode(n) {
  return {
    id:       n.id,
    name:     resolveDisplayName(n),
    intent:   n.intent || 'definition',
    weight:   n.weight || 60,
    path:     n.path || extractPathFromId(n.id),
    line:     n.location?.start?.line || 1,
    location: n.location || { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    metadata: n.metadata || {},
    seed:     false,
    depth:    -1,
  };
}

// Map SemanticNode → display node format.
// SemanticNode fields: id, intent, name, target?, location, weight, metadata, path (added by graphPanel)
const NODES = rawData.nodes.map(n => ({
  id: n.id,
  name: resolveDisplayName(n),
  intent: n.intent || 'definition',
  weight: n.weight || 60,
  path: n.path || n.id,              // abs path injected by graphPanel.ts
  line: n.location?.start?.line || 1,
  location: n.location || { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
  metadata: n.metadata || {},
  seed: false,
  depth: -1,
}));

// SemanticEdge fields: from, to, weight
const EDGES = rawData.edges.map(e => ({
  from: e.from,
  to: e.to,
  weight: e.weight || 1,
}));

// ── SEED DETECTION ───────────────────────────────────────────────────────────
// The active file (passed via rawData.activeFilePath) is always the BFS root.
// Depth is measured from it so the initial view centres on what the developer opened.
(function computeDepths() {
  if (!NODES.length) return;

  let seeds = [];

  // Primary: use the active file's Program node as the sole seed.
  if (rawData.activeFilePath) {
    const norm = rawData.activeFilePath.replace(/\\/g, '/').toLowerCase();
    const activeProgram = NODES.find(n =>
      n.metadata?.nodeType === 'Program' &&
      (n.path || '').replace(/\\/g, '/').toLowerCase() === norm
    );
    if (activeProgram) seeds = [activeProgram];
    console.log('[Stractura] activeFilePath seed:', rawData.activeFilePath, '→ found:', !!activeProgram);
  }

  // Fallback: Program nodes with no incoming edges (natural entry points).
  if (!seeds.length) {
    const incomingCount = new Map();
    NODES.forEach(n => incomingCount.set(n.id, 0));
    EDGES.forEach(e => incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1));
    seeds = NODES.filter(n => n.metadata?.nodeType === 'Program' && incomingCount.get(n.id) === 0);
    if (!seeds.length) {
      seeds = NODES.filter(n => { const ic = incomingCount.get(n.id) || 0; return ic === 0; })
        .sort((a, b) => (b.weight || 0) - (a.weight || 0));
    }
  }

  // Last resort: highest out-degree nodes.
  if (!seeds.length) {
    const outCount = new Map();
    EDGES.forEach(e => outCount.set(e.from, (outCount.get(e.from) || 0) + 1));
    seeds = [...NODES].sort((a, b) => (outCount.get(b.id) || 0) - (outCount.get(a.id) || 0)).slice(0, 3);
  }

  // Mark seeds (a single seed for the active-file path).
  seeds.slice(0, 1).forEach(n => { n.seed = true; n.depth = 0; });

  // BFS to assign depths
  const adj = new Map();
  NODES.forEach(n => adj.set(n.id, []));
  EDGES.forEach(e => { adj.get(e.from)?.push(e.to); adj.get(e.to)?.push(e.from); });

  const queue = NODES.filter(n => n.seed);
  while (queue.length) {
    const cur = queue.shift();
    for (const nid of (adj.get(cur.id) || [])) {
      const neighbor = NODES.find(n => n.id === nid);
      if (neighbor && neighbor.depth === -1) {
        neighbor.depth = cur.depth + 1;
        queue.push(neighbor);
      }
    }
  }

  // Anything still at -1 (disconnected) gets max depth
  NODES.forEach(n => { if (n.depth === -1) n.depth = 99; });

  // [DEBUG] Report seed detection results
  const seedNodes = NODES.filter(n => n.seed);
  console.log('[Stractura] seeds detected:', seedNodes.map(n => n.id));
  console.log('[Stractura] depth distribution:', NODES.reduce((acc, n) => { acc[n.depth] = (acc[n.depth]||0)+1; return acc; }, {}));
  console.log('[Stractura] NODES count:', NODES.length, '| EDGES count:', EDGES.length);
})();

// ── LOOKUP MAPS ──────────────────────────────────────────────────────────────
const nodeMap = new Map(NODES.map(n => [n.id, n]));
function getNode(id) { return nodeMap.get(id); }
function getNeighborIds(id) {
  const out = EDGES.filter(e => e.from === id).map(e => e.to);
  const inc = EDGES.filter(e => e.to === id).map(e => e.from);
  return [...new Set([...out, ...inc])];
}
