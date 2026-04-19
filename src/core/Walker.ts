/**
 * walk.ts
 *
 * Generic AST traversal primitives decoupled from semantic extraction.
 * Import these building blocks wherever AST walking is needed.
 */

import { scopeForNode,type  ScopeKind } from "../uitlities/walker.js";

/** 
 * A map of AST node-type strings to visitor callbacks. 
 * */
export type Visitor = Record<string, (node: any) => void>;

/**
 * Depth-first AST walk.
 * Calls `visitor[node.type](node)` when a handler is registered,
 * then recurses into all child nodes and array children.
 */
export const walk = (node: any, visitor: Visitor): void => {
  if (!node || typeof node !== "object") return;

  if (visitor[node.type]) {
    visitor[node.type](node);
  }

  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => walk(c, visitor));
    } else if (child && typeof child.type === "string") {
      walk(child, visitor);
    }
  }
};


/** Callback receives the current scope stack in addition to the node. */
export type ScopedVisitor = Record<
  string,
  (node: any, scopeStack: readonly ScopeKind[]) => void
>;

/**
 * Walk the AST while maintaining a scope stack.
 * Function / class / block boundaries automatically push and pop scopes.
 *
 * @param exitVisitor  Optional map of node-type → callback invoked *after* all
 *                     children have been visited (and after the scope is popped).
 *                     Used by the edge-driving layer to pop the parentIdStack.
 */
export const walkScoped = (
  node: any,
  visitor: ScopedVisitor,
  scopeStack: ScopeKind[] = ["module"],
  exitVisitor?: ScopedVisitor
): void => {
  if (!node || typeof node !== "object") return;

  // OXC parser emits flat { start, end } on nodes instead of a nested span object.
  // Normalise here once so every visitor can safely read node.span.
  if (typeof node.start === "number" && node.span === undefined) {
    node.span = { start: node.start, end: node.end };
  }

  if (visitor[node.type]) {
    visitor[node.type](node, scopeStack);
  }

  // Determine if this node introduces a new scope
  const newScope = scopeForNode(node.type);

  if (newScope) scopeStack.push(newScope);

  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => walkScoped(c, visitor, scopeStack, exitVisitor));
    } else if (child && typeof child.type === "string") {
      walkScoped(child, visitor, scopeStack, exitVisitor);
    }
  }

  if (newScope) scopeStack.pop();

  // Exit hook: called after all children and after the scope is restored.
  if (exitVisitor?.[node.type]) {
    exitVisitor[node.type](node, scopeStack);
  }
};

/**
 * Collect all nodes of a given type from an AST subtree.
 * Useful for quick one-off queries without a full visitor map.
 */
export const collectByType = <T = any>(ast: any, type: string): T[] => {
  const results: T[] = [];
  walk(ast, {
    [type]: (node: T) => results.push(node),
  });
  return results;
};