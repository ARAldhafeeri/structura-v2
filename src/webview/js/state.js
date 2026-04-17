// ── COLORS ───────────────────────────────────────────────────────────────────
const intentColor = {
  definition: '#00c8ff',
  call:       '#7b2fff',
  import:     '#00ffb2',
  export:     '#ff6b35',
  type:       '#f0c040',
  reference:  '#806050',
};

// ── STATE ─────────────────────────────────────────────────────────────────────
const state = {
  visibleNodeIds: new Set(),
  selectedNodeId: null,
  pinnedNodeIds: new Set(),
  currentDepth: 0,
  history: [],
  historyIndex: -1,
  cy: null,
  ctxTargetId: null,
  expandingFromId: null,   // source node of the last expand-node command
};
