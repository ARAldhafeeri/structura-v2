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
 */
export const walkScoped = (
  node: any,
  visitor: ScopedVisitor,
  scopeStack: ScopeKind[] = ["module"]
): void => {
  if (!node || typeof node !== "object") return;

  if (visitor[node.type]) {
    visitor[node.type](node, scopeStack);
  }

  // Determine if this node introduces a new scope
  const newScope = scopeForNode(node.type);

  if (newScope) scopeStack.push(newScope);

  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => walkScoped(c, visitor, scopeStack));
    } else if (child && typeof child.type === "string") {
      walkScoped(child, visitor, scopeStack);
    }
  }

  if (newScope) scopeStack.pop();
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