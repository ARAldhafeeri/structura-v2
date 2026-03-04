import { WEIGHTS } from "../graph/weights";
import type { SemanticNode, SemanticNodeMetadata } from "../contract";
import {
  makeId,
  spanToLoc,
  ident,
  resolveCallee,
  extractParams,
  serializeType,
  serializeExpr,
} from "../uitlities/parser";

import type { ScopeKind } from "../uitlities/walker";

/**
 * Convenience alias used inside visitors.
 */
type Loc = ReturnType<typeof spanToLoc>;

/**
 * Shared context injected into every visitor factory so they can
 * produce nodes and resolve source locations without global state.
 */
export interface VisitorContext {
  filePath: string;
  nodes: SemanticNode[];
  loc: (span: any) => Loc;
  currentScope: (stack: readonly ScopeKind[]) => SemanticNodeMetadata["scope"];
}


/**
 * Extract side-effect and specifier imports.
 * Handles default, namespace, and named import specifiers.
 */
export const importDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const moduleSource: string = node.source?.value ?? node.source;
    const specifiers: any[] = node.specifiers ?? [];

    // Side-effect import: import 'module'
    if (specifiers.length === 0) {
      const l = loc(node.span);
      nodes.push({
        id: makeId(filePath, l, "ImportDeclaration"),
        intent: "import",
        name: moduleSource,
        target: moduleSource,
        location: l,
        weight: WEIGHTS.import,
        metadata: {
          nodeType: "ImportDeclaration",
          scope: currentScope(stack),
          importKind: node.typeOnly ? "type" : "value",
          isSideEffect: true,
        },
      });
      return;
    }

    for (const spec of specifiers) {
      const l = loc(spec.span ?? node.span);
      let name: string;
      let isDefault = false;
      let isNamed = false;

      if (spec.type === "ImportDefaultSpecifier") {
        name = ident(spec.local);
        isDefault = true;
      } else if (spec.type === "ImportNamespaceSpecifier") {
        name = `* as ${ident(spec.local)}`;
      } else {
        // ImportSpecifier (named)
        name = ident(spec.local);
        isNamed = true;
      }

      nodes.push({
        id: makeId(filePath, l, spec.type ?? "ImportSpecifier"),
        intent: "import",
        name,
        target: moduleSource,
        location: l,
        weight: WEIGHTS.import,
        metadata: {
          nodeType: spec.type ?? "ImportSpecifier",
          scope: currentScope(stack),
          importKind: node.typeOnly ? "type" : "value",
          isDefault,
          isNamed,
        },
      });
    }
  };


/**
 * Extract named export declarations.
 * Handles specifier lists, function/class/variable/TS type re-exports.
 */
export const exportNamedDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const exportKind = node.typeOnly ? "type" : "value";

    // export { a, b } or export { a, b } from 'x'
    if (node.specifiers?.length) {
      for (const spec of node.specifiers) {
        const sl = loc(spec.span ?? node.span);
        nodes.push({
          id: makeId(filePath, sl, "ExportSpecifier"),
          intent: "export",
          name: ident(spec.exported),
          target: node.source?.value,
          location: sl,
          weight: WEIGHTS.export,
          metadata: {
            nodeType: "ExportSpecifier",
            scope: currentScope(stack),
            exportKind,
            localName: ident(spec.local),
          },
        });
      }
      return;
    }

    if (!node.declaration) return;
    const decl = node.declaration;

    if (
      decl.type === "FunctionDeclaration" ||
      decl.type === "TSFunctionDeclaration"
    ) {
      nodes.push({
        id: makeId(filePath, l, "ExportNamedDeclaration"),
        intent: "export",
        name: ident(decl.id),
        location: l,
        weight: WEIGHTS.export,
        metadata: {
          nodeType: "ExportNamedDeclaration",
          scope: currentScope(stack),
          exportKind: "value",
        },
      });
    } else if (decl.type === "ClassDeclaration") {
      nodes.push({
        id: makeId(filePath, l, "ExportNamedDeclaration"),
        intent: "export",
        name: ident(decl.id),
        location: l,
        weight: WEIGHTS.export,
        metadata: {
          nodeType: "ExportNamedDeclaration",
          scope: currentScope(stack),
          exportKind: "value",
        },
      });
    } else if (decl.type === "VariableDeclaration") {
      for (const d of decl.declarations ?? []) {
        const vl = loc(d.span ?? node.span);
        nodes.push({
          id: makeId(filePath, vl, "ExportVariableDeclarator"),
          intent: "export",
          name: ident(d.id),
          location: vl,
          weight: WEIGHTS.export,
          metadata: {
            nodeType: "ExportVariableDeclarator",
            scope: currentScope(stack),
            exportKind: "value",
          },
        });
      }
    } else if (
      decl.type === "TSTypeAliasDeclaration" ||
      decl.type === "TSInterfaceDeclaration" ||
      decl.type === "TSEnumDeclaration"
    ) {
      nodes.push({
        id: makeId(filePath, l, "ExportNamedDeclaration"),
        intent: "export",
        name: ident(decl.id),
        location: l,
        weight: WEIGHTS.export,
        metadata: {
          nodeType: "ExportNamedDeclaration",
          scope: currentScope(stack),
          exportKind: "type",
        },
      });
    }
  };

/**
 * Extract default export declarations.
 * Resolves name from function/class id or falls back to sentinel strings.
 */
export const exportDefaultDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const decl = node.declaration;
    let name = "default";

    if (decl?.id?.name) name = decl.id.name;
    else if (decl?.type === "FunctionDeclaration") name = "default:function";
    else if (decl?.type === "ClassDeclaration") name = "default:class";

    nodes.push({
      id: makeId(filePath, l, "ExportDefaultDeclaration"),
      intent: "export",
      name,
      location: l,
      weight: WEIGHTS.export,
      metadata: {
        nodeType: "ExportDefaultDeclaration",
        scope: currentScope(stack),
        exportKind: "value",
        isDefault: true,
      },
    });
  };

/**
 * Extract barrel / re-export-all declarations (`export * from 'x'`).
 */
export const exportAllDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "ExportAllDeclaration"),
      intent: "export",
      name: node.exported ? ident(node.exported) : "*",
      target: node.source?.value,
      location: l,
      weight: WEIGHTS.export,
      metadata: {
        nodeType: "ExportAllDeclaration",
        scope: currentScope(stack),
        exportKind: "value",
      },
    });
  };


/**
 * Extract named function declarations.
 * Anonymous function expressions are skipped.
 */
export const functionDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (!node.id) return; // anonymous function expression — skip
    const l = loc(node.span);
    const isExported =
      node.modifiers?.some((m: any) => m.kind === "export") ?? false;

    nodes.push({
      id: makeId(filePath, l, "FunctionDeclaration"),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.function,
      metadata: {
        nodeType: "FunctionDeclaration",
        scope: currentScope(stack),
        visibility: "public",
        isAsync: node.async ?? false,
        isExported,
        parameters: extractParams(node.params ?? []),
        returnType: serializeType(node.returnType?.typeAnnotation),
      },
    });
  };

/**
 * Extract class declarations.
 * Export status is resolved later by the paired ExportNamedDeclaration node.
 */
export const classDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (!node.id) return;
    const l = loc(node.span);

    nodes.push({
      id: makeId(filePath, l, "ClassDeclaration"),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.class,
      metadata: {
        nodeType: "ClassDeclaration",
        scope: currentScope(stack),
        visibility: "public",
        isExported: false, // set by the paired ExportNamedDeclaration node
        superClass: node.superClass
          ? resolveCallee(node.superClass)
          : undefined,
        decorators:
          node.decorators?.map(
            (d: any) => serializeExpr(d.expression) ?? ident(d.expression)
          ) ?? [],
      },
    });
  };

/**
 * Extract method definitions within a class.
 * Preserves constructor weight distinction and access modifiers.
 */
export const methodDefinitionVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name =
      node.key?.name ??
      node.key?.value ??
      (node.kind === "constructor" ? "constructor" : "unknown");
    const isConstructor = node.kind === "constructor";

    const visibility: SemanticNodeMetadata["visibility"] =
      node.accessibility === "private"
        ? "private"
        : node.accessibility === "protected"
        ? "protected"
        : "public";

    nodes.push({
      id: makeId(filePath, l, "MethodDefinition"),
      intent: "definition",
      name,
      location: l,
      weight: isConstructor ? WEIGHTS.constructor : WEIGHTS.method,
      metadata: {
        nodeType: "MethodDefinition",
        scope: "class",
        visibility,
        isStatic: node.static ?? false,
        isAsync: node.value?.async ?? false,
        parameters: extractParams(node.value?.params ?? []),
        returnType: serializeType(node.value?.returnType?.typeAnnotation),
      },
    });
  };

/**
 * Extract arrow functions and function expressions assigned to variables.
 * Skips declarators without an initialiser or with non-function initialisers.
 */
export const variableDeclaratorVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (!node.init) return;
    const init = node.init;

    const isFn =
      init.type === "ArrowFunctionExpression" ||
      init.type === "FunctionExpression";
    if (!isFn) return;

    const l = loc(node.span);

    nodes.push({
      id: makeId(filePath, l, init.type),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.function,
      metadata: {
        nodeType: init.type,
        scope: currentScope(stack),
        visibility: "public",
        isAsync: init.async ?? false,
        parameters: extractParams(init.params ?? []),
        returnType: serializeType(init.returnType?.typeAnnotation),
      },
    });
  };


/**
 * Extract TypeScript type alias declarations (`type Foo = ...`).
 */
export const tsTypeAliasDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSTypeAliasDeclaration"),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSTypeAliasDeclaration",
        scope: currentScope(stack),
        exportKind: "type",
      },
    });
  };

/**
 * Extract TypeScript interface declarations (`interface Foo { ... }`).
 */
export const tsInterfaceDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSInterfaceDeclaration"),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.interface,
      metadata: {
        nodeType: "TSInterfaceDeclaration",
        scope: currentScope(stack),
        exportKind: "type",
        extends: node.extends?.map((e: any) => ident(e.expression)) ?? [],
      },
    });
  };

/**
 * Extract TypeScript enum declarations (`enum Foo { ... }`).
 */
export const tsEnumDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSEnumDeclaration"),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.enum,
      metadata: {
        nodeType: "TSEnumDeclaration",
        scope: currentScope(stack),
        isConst: node.const ?? false,
      },
    });
  };


/**
 * Extract call expressions.
 * Filters out noisy low-value call sites such as `console.*` and `process.*`.
 */
export const callExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const target = resolveCallee(node.callee);
    const name = target.split(".").pop() ?? target;

    // Filter out noisy low-value call sites
    if (target.startsWith("console.") || target.startsWith("process.")) return;

    nodes.push({
      id: makeId(filePath, l, "CallExpression"),
      intent: "call",
      name,
      target,
      location: l,
      weight: WEIGHTS.callback,
      metadata: {
        nodeType: "CallExpression",
        scope: currentScope(stack),
        callee: target,
        chained:
          node.callee?.type === "CallExpression" ||
          node.callee?.type === "MemberExpression",
      },
    });
  };

/**
 * Extract `new` expressions (constructor call sites).
 */
export const newExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const target = resolveCallee(node.callee);

    nodes.push({
      id: makeId(filePath, l, "NewExpression"),
      intent: "call",
      name: target,
      target,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "NewExpression",
        scope: currentScope(stack),
      },
    });
  };