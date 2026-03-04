export type ScopeKind = "module" | "function" | "class" | "block" | "global";


/** 
 * Returns the scope kind introduced by a given AST node type, or null.
 *  */
export const scopeForNode = (type: string): ScopeKind | null => {
  switch (type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "MethodDefinition":
      return "function";
    case "ClassDeclaration":
    case "ClassExpression":
      return "class";
    case "BlockStatement":
      return "block";
    default:
      return null;
  }
};



/**
 * Find the first node matching `predicate` in depth-first order.
 */
export const findFirst = <T = any>(
  ast: any,
  predicate: (node: any) => boolean
): T | undefined => {
  let found: T | undefined;

  const search = (node: any): boolean => {
    if (!node || typeof node !== "object") return false;

    if (predicate(node)) {
      found = node as T;
      return true;
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        if (child.some((c) => search(c))) return true;
      } else if (child && typeof child.type === "string") {
        if (search(child)) return true;
      }
    }

    return false;
  };

  search(ast);
  return found;
};