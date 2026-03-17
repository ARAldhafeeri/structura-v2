import type { SemanticNode } from "./Graph.js";

export type SemanticSearchResult = { nodeId: string; node: SemanticNode; score: number; matches: string[] };
