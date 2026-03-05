import type { SemanticNode, SemanticNodeMetadata } from "../contract.js";
import { buildLineOffsets, spanToLoc } from "../uitlities/parser.js";
import { walkScoped } from "./Walker.js";
import { type ScopeKind } from "../uitlities/walker.js";
// import all visitors
import {
  buildAdditionalVisitors,
  type VisitorContext,
} from "./Visitors.js";

/**
 * Walks a JS/TS/JSX/TSX AST and extracts all semantic nodes
 * (imports, exports, definitions, and call sites) into a flat list.
 *
 * @param ast      SWC-parsed AST for the file
 * @param filePath Absolute or relative path used to namespace node IDs
 * @param source   Raw source text, required to resolve line/column offsets
 */
export const extractSemanticNodes = (
  ast: any,
  filePath: string,
  source: string
): SemanticNode[] => {
  const nodes: SemanticNode[] = [];
  const lineOffsets = buildLineOffsets(source);

  // Convert an SWC span to a SourceLocation.
  const loc = (span: any) => spanToLoc(span, lineOffsets);

  // Current innermost scope from the stack.
  const currentScope = (
    stack: readonly ScopeKind[]
  ): SemanticNodeMetadata["scope"] =>
    stack[stack.length - 1] as SemanticNodeMetadata["scope"];

  // Shared context passed into every visitor factory.
  const ctx: VisitorContext = { filePath, nodes, loc, currentScope };

  const visitors = buildAdditionalVisitors(ctx);

  walkScoped(ast, visitors);

  return nodes;
};