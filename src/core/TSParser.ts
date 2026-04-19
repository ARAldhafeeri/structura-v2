import type { SemanticNode, SemanticNodeMetadata, SemanticEdge } from "../contract/Graph.js";
import { buildLineOffsets, spanToLoc } from "../uitlities/parser.js";
import { walkScoped } from "./Walker.js";
import { type ScopeKind } from "../uitlities/walker.js";
// import all visitors
import {
  buildAdditionalVisitors,
  buildAdditionalExitVisitors,
  fileProgramId,
  type VisitorContext,
  type ImportEdgeStub,
} from "./Visitors.js";

export interface SemanticParseResult {
  nodes: SemanticNode[];
  /** Intra-file contains edges (file Program → definition). */
  edges: SemanticEdge[];
  /** Cross-file import stubs to be resolved after all files are parsed. */
  importStubs: ImportEdgeStub[];
}

/**
 * Walks a JS/TS/JSX/TSX AST and extracts all semantic nodes and edges.
 *
 * @param ast      OXC-parsed AST for the file
 * @param filePath Absolute path used to namespace node IDs
 * @param source   Raw source text, required to resolve line/column offsets
 */
export const extractSemanticNodes = (
  ast: any,
  filePath: string,
  source: string
): SemanticParseResult => {
  const nodes: SemanticNode[] = [];
  const edges: SemanticEdge[] = [];
  const importStubs: ImportEdgeStub[] = [];
  const lineOffsets = buildLineOffsets(source);

  // Convert an OXC span to a SourceLocation.
  const loc = (span: any) => spanToLoc(span, lineOffsets);

  // Current innermost scope from the stack.
  const currentScope = (
    stack: readonly ScopeKind[]
  ): SemanticNodeMetadata["scope"] =>
    stack[stack.length - 1] as SemanticNodeMetadata["scope"];

  // Shared context passed into every visitor factory.
  const ctx: VisitorContext = {
    filePath, nodes, edges, importStubs, loc, currentScope,
    // Initialise with the file's Program node so module-level definitions
    // always have a valid parent before any scope-creating visitor runs.
    parentIdStack: [fileProgramId(filePath)],
  };

  const visitors = buildAdditionalVisitors(ctx);
  const exitVisitors = buildAdditionalExitVisitors(ctx);

  walkScoped(ast, visitors, ["module"], exitVisitors);

  return { nodes, edges, importStubs };
};