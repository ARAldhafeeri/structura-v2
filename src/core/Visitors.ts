import { WEIGHTS } from "../graph/weights.js";
import type { SemanticNode, SemanticNodeMetadata } from "../contract.js";
import {
  makeId,
  spanToLoc,
  ident,
  resolveCallee,
  extractParams,
  serializeType,
  serializeExpr,
} from "../uitlities/parser.js";

import type { ScopeKind } from "../uitlities/walker.js";

type Loc = ReturnType<typeof spanToLoc>;

export interface VisitorContext {
  filePath: string;
  nodes: SemanticNode[];
  loc: (span: any) => Loc;
  currentScope: (stack: readonly ScopeKind[]) => SemanticNodeMetadata["scope"];
}

// ─────────────────────────────────────────────────────────────────────────────
// DECLARATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract variable declarations (const / let / var).
 * Only captures non-function initialisers — function-valued declarators are
 * already handled by `variableDeclaratorVisitor`.
 */
export const variableDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    for (const decl of node.declarations ?? []) {
      if (!decl.id) continue;
      // Skip arrow / function expressions – those are captured by variableDeclaratorVisitor
      const initType = decl.init?.type;
      if (
        initType === "ArrowFunctionExpression" ||
        initType === "FunctionExpression"
      )
        continue;

      const l = loc(decl.span ?? node.span);
      nodes.push({
        id: makeId(filePath, l, "VariableDeclarator"),
        intent: "definition",
        name: ident(decl.id),
        location: l,
        weight: WEIGHTS.declare,
        metadata: {
          nodeType: "VariableDeclarator",
          scope: currentScope(stack),
          kind: node.kind, // "const" | "let" | "var"
          isExported: false,
        },
      });
    }
  };

/**
 * Extract generator function declarations (`function* foo() {}`).
 */
export const generatorFunctionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (!node.generator) return;
    if (!node.id) return;
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "GeneratorFunction"),
      intent: "definition",
      name: ident(node.id),
      location: l,
      weight: WEIGHTS.function,
      metadata: {
        nodeType: "GeneratorFunction",
        scope: currentScope(stack),
        visibility: "public",
        isAsync: node.async ?? false,
        isGenerator: true,
        parameters: extractParams(node.params ?? []),
        returnType: serializeType(node.returnType?.typeAnnotation),
      },
    });
  };

// ─────────────────────────────────────────────────────────────────────────────
// CLASS MEMBERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract class property / field definitions.
 *   class Foo { bar = 1; #priv = true; }
 */
export const propertyDefinitionVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name =
      node.key?.name ?? node.key?.value ?? serializeExpr(node.key) ?? "unknown";

    const visibility: SemanticNodeMetadata["visibility"] =
      node.accessibility === "private" || node.key?.type === "PrivateIdentifier"
        ? "private"
        : node.accessibility === "protected"
        ? "protected"
        : "public";

    nodes.push({
      id: makeId(filePath, l, "PropertyDefinition"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "PropertyDefinition",
        scope: "class",
        visibility,
        isStatic: node.static ?? false,
        isReadonly: node.readonly ?? false,
        typeAnnotation: serializeType(node.typeAnnotation?.typeAnnotation),
      },
    });
  };

/**
 * Extract static class blocks (`static { ... }`).
 */
export const staticBlockVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "StaticBlock"),
      intent: "definition",
      name: "static",
      location: l,
      weight: WEIGHTS.method,
      metadata: {
        nodeType: "StaticBlock",
        scope: "class",
        visibility: "public",
        isStatic: true,
      },
    });
  };

// ─────────────────────────────────────────────────────────────────────────────
// JSX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract JSX element usage (both opening and self-closing).
 * Captures component name and whether it is a custom component vs. DOM tag.
 */
export const jsxOpeningElementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const rawName =
      node.name && (node.name.name || serializeExpr(node.name)) || "unknown";

    const isCustom = /^[A-Z]/.test(rawName) || rawName.includes(".");

    nodes.push({
      id: makeId(filePath, l, "JSXOpeningElement"),
      intent: "call",
      name: rawName,
      target: rawName,
      location: l,
      weight: isCustom ? WEIGHTS.callback : WEIGHTS.declare,
      metadata: {
        nodeType: "JSXOpeningElement",
        scope: currentScope(stack),
        isCustomComponent: isCustom,
        isSelfClosing: node.selfClosing ?? false,
      },
    });
  };

/**
 * Extract JSX fragments (`<>...</>`).
 */
export const jsxFragmentVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "JSXFragment"),
      intent: "call",
      name: "Fragment",
      target: "React.Fragment",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "JSXFragment",
        scope: currentScope(stack),
        isCustomComponent: false,
      },
    });
  };

/**
 * Extract JSX spread attributes (`<Comp {...props} />`).
 */
export const jsxSpreadAttributeVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "JSXSpreadAttribute"),
      intent: "call",
      name: serializeExpr(node.argument) ?? "spread",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "JSXSpreadAttribute",
        scope: currentScope(stack),
      },
    });
  };

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract tagged template expressions (`gql`...``, css`...``).
 * These are common in GraphQL, styled-components, etc.
 */
export const taggedTemplateExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const target = resolveCallee(node.tag);
    nodes.push({
      id: makeId(filePath, l, "TaggedTemplateExpression"),
      intent: "call",
      name: target,
      target,
      location: l,
      weight: WEIGHTS.callback,
      metadata: {
        nodeType: "TaggedTemplateExpression",
        scope: currentScope(stack),
        callee: target,
      },
    });
  };

/**
 * Extract `await` expressions.
 * Useful for identifying async data-flow boundaries.
 */
export const awaitExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const target =
      node.argument?.type === "CallExpression"
        ? resolveCallee(node.argument.callee)
        : serializeExpr(node.argument) ?? "unknown";

    nodes.push({
      id: makeId(filePath, l, "AwaitExpression"),
      intent: "call",
      name: target,
      target,
      location: l,
      weight: WEIGHTS.callback,
      metadata: {
        nodeType: "AwaitExpression",
        scope: currentScope(stack),
        callee: target,
      },
    });
  };

/**
 * Extract `yield` expressions inside generators.
 */
export const yieldExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "YieldExpression"),
      intent: "call",
      name: "yield",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "YieldExpression",
        scope: currentScope(stack),
        delegate: node.delegate ?? false,
      },
    });
  };

/**
 * Extract assignment expressions.
 * Useful for tracking mutation of module-level variables.
 */
export const assignmentExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    // Only capture module/class-level assignments to reduce noise
    const scope = currentScope(stack);
    if (scope !== "module" && scope !== "class") return;

    const l = loc(node.span);
    const name = serializeExpr(node.left) ?? "unknown";
    nodes.push({
      id: makeId(filePath, l, "AssignmentExpression"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "AssignmentExpression",
        scope,
        operator: node.operator,
      },
    });
  };

/**
 * Extract `import()` dynamic import expressions.
 */
export const importExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    // source may be a StringLiteral or a template
    const target =
      node.source?.value ?? serializeExpr(node.source) ?? "dynamic";
    nodes.push({
      id: makeId(filePath, l, "ImportExpression"),
      intent: "import",
      name: target,
      target,
      location: l,
      weight: WEIGHTS.import,
      metadata: {
        nodeType: "ImportExpression",
        scope: currentScope(stack),
        importKind: "value",
      },
    });
  };

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript EXTRAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract TypeScript namespace / module declarations.
 *   namespace Foo { ... }   /   module Foo { ... }
 */
export const tsModuleDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSModuleDeclaration"),
      intent: "definition",
      name: node.id?.value ?? node.id?.name ?? ident(node.id),
      location: l,
      weight: WEIGHTS.class,
      metadata: {
        nodeType: "TSModuleDeclaration",
        scope: currentScope(stack),
        exportKind: "value",
        isAmbient: node.declare ?? false,
        kind: node.kind ?? "namespace", // "namespace" | "module" | "global"
      },
    });
  };

/**
 * Extract TypeScript `declare module '…'` / ambient module declarations.
 * OXC emits these as TSModuleDeclaration with kind === "module" and declare === true.
 * This visitor is an alias that narrows to ambient-only for clarity.
 */
export const tsAmbientModuleDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (!node.declare) return; // only ambient
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSAmbientModuleDeclaration"),
      intent: "definition",
      name: node.id?.value ?? node.id?.name ?? ident(node.id),
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSAmbientModuleDeclaration",
        scope: currentScope(stack),
        exportKind: "type",
        isAmbient: true,
      },
    });
  };

/**
 * Extract `declare global { … }` blocks.
 */
export const tsGlobalDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (node.kind !== "global") return;
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSGlobalDeclaration"),
      intent: "definition",
      name: "global",
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSGlobalDeclaration",
        scope: currentScope(stack),
        exportKind: "type",
      },
    });
  };

/**
 * Extract TypeScript `declare` statements (variables, functions, classes, etc.)
 * that use the ambient `declare` keyword.
 * OXC surfaces `declare: true` on the wrapping declaration node.
 */
export const tsDeclareStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (!node.declare) return;
    const l = loc(node.span);
    const name = node.id ? ident(node.id) : "declare";
    nodes.push({
      id: makeId(filePath, l, "TSDeclareStatement"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSDeclareStatement",
        scope: currentScope(stack),
        exportKind: "type",
        isAmbient: true,
      },
    });
  };

/**
 * Extract TypeScript constructor signatures inside interfaces / abstract classes.
 *   interface Foo { new(x: number): Foo; }
 */
export const tsConstructSignatureDeclarationVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSConstructSignatureDeclaration"),
      intent: "definition",
      name: "new",
      location: l,
      weight: WEIGHTS.constructor,
      metadata: {
        nodeType: "TSConstructSignatureDeclaration",
        scope: "class",
        visibility: "public",
        parameters: extractParams(node.params ?? []),
        returnType: serializeType(node.typeAnnotation?.typeAnnotation),
      },
    });
  };

/**
 * Extract TypeScript call signatures inside interfaces.
 *   interface Fn { (x: number): void; }
 */
export const tsCallSignatureDeclarationVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSCallSignatureDeclaration"),
      intent: "definition",
      name: "call",
      location: l,
      weight: WEIGHTS.method,
      metadata: {
        nodeType: "TSCallSignatureDeclaration",
        scope: "class",
        visibility: "public",
        parameters: extractParams(node.params ?? []),
        returnType: serializeType(node.typeAnnotation?.typeAnnotation),
      },
    });
  };

/**
 * Extract TypeScript index signatures.
 *   interface Foo { [key: string]: number; }
 */
export const tsIndexSignatureVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSIndexSignature"),
      intent: "definition",
      name: "index",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "TSIndexSignature",
        scope: "class",
        visibility: "public",
        isReadonly: node.readonly ?? false,
        isStatic: node.static ?? false,
        parameters: extractParams(node.parameters ?? []),
        returnType: serializeType(node.typeAnnotation?.typeAnnotation),
      },
    });
  };

/**
 * Extract TypeScript method signatures inside interfaces/type literals.
 *   interface Foo { bar(x: number): void; }
 */
export const tsMethodSignatureVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.key?.name ?? node.key?.value ?? serializeExpr(node.key) ?? "unknown";
    nodes.push({
      id: makeId(filePath, l, "TSMethodSignature"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.method,
      metadata: {
        nodeType: "TSMethodSignature",
        scope: "class",
        visibility: "public",
        optional: node.optional ?? false,
        computed: node.computed ?? false,
        parameters: extractParams(node.params ?? []),
        returnType: serializeType(node.returnType?.typeAnnotation),
      },
    });
  };

/**
 * Extract TypeScript property signatures inside interfaces/type literals.
 *   interface Foo { bar: number; readonly baz?: string; }
 */
export const tsPropertySignatureVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, _stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.key?.name ?? node.key?.value ?? serializeExpr(node.key) ?? "unknown";
    nodes.push({
      id: makeId(filePath, l, "TSPropertySignature"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "TSPropertySignature",
        scope: "class",
        visibility: "public",
        optional: node.optional ?? false,
        computed: node.computed ?? false,
        isReadonly: node.readonly ?? false,
        typeAnnotation: serializeType(node.typeAnnotation?.typeAnnotation),
      },
    });
  };

/**
 * Extract TypeScript `import type` declarations (type-only imports).
 * OXC surfaces these with `importKind === "type"` on the ImportDeclaration,
 * but also emits a dedicated TSImportEqualsDeclaration for CommonJS-style
 * `import Foo = require('bar')`.
 */
export const tsImportEqualsDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const target =
      node.moduleReference?.expression?.value ??
      node.moduleReference?.expression?.name ??
      serializeExpr(node.moduleReference) ??
      "unknown";

    nodes.push({
      id: makeId(filePath, l, "TSImportEqualsDeclaration"),
      intent: "import",
      name: ident(node.id),
      target,
      location: l,
      weight: WEIGHTS.import,
      metadata: {
        nodeType: "TSImportEqualsDeclaration",
        scope: currentScope(stack),
        importKind: node.importKind ?? "value",
        isExported: node.isExport ?? false,
      },
    });
  };

/**
 * Extract TypeScript `export = Foo` / CommonJS-style default exports.
 */
export const tsExportAssignmentVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = serializeExpr(node.expression) ?? "export=";
    nodes.push({
      id: makeId(filePath, l, "TSExportAssignment"),
      intent: "export",
      name,
      location: l,
      weight: WEIGHTS.export,
      metadata: {
        nodeType: "TSExportAssignment",
        scope: currentScope(stack),
        exportKind: "value",
        isDefault: true,
      },
    });
  };

/**
 * Extract TypeScript `export as namespace Foo` declarations.
 */
export const tsNamespaceExportDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSNamespaceExportDeclaration"),
      intent: "export",
      name: node.id?.name ?? ident(node.id),
      location: l,
      weight: WEIGHTS.export,
      metadata: {
        nodeType: "TSNamespaceExportDeclaration",
        scope: currentScope(stack),
        exportKind: "value",
      },
    });
  };

/**
 * Extract TypeScript `as const` / `satisfies` / `as Type` cast expressions.
 * Useful for tracking type narrowing in module-level code.
 */
export const tsTypeAssertionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const scope = currentScope(stack);
    if (scope !== "module") return; // suppress inner noise
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSTypeAssertion"),
      intent: "definition",
      name: serializeType(node.typeAnnotation) ?? "unknown",
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSTypeAssertion",
        scope,
      },
    });
  };

/**
 * Extract TypeScript decorator factory calls (`@Injectable()`, `@Component({})`).
 * OXC surfaces these as `Decorator` nodes with an `expression` child.
 */
export const decoratorVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const target =
      node.expression?.type === "CallExpression"
        ? resolveCallee(node.expression.callee)
        : serializeExpr(node.expression) ?? "unknown";

    nodes.push({
      id: makeId(filePath, l, "Decorator"),
      intent: "call",
      name: target,
      target,
      location: l,
      weight: WEIGHTS.callback,
      metadata: {
        nodeType: "Decorator",
        scope: currentScope(stack),
        callee: target,
        isFactory: node.expression?.type === "CallExpression",
      },
    });
  };

// ─────────────────────────────────────────────────────────────────────────────
// PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract destructuring assignments used as standalone statements.
 * Covers both array and object destructuring at module/function scope.
 *   const { a, b } = obj;  /  const [x, y] = arr;
 */
export const destructuringPatternVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (
      node.type !== "ObjectPattern" &&
      node.type !== "ArrayPattern"
    )
      return;
    // Only surface top-level patterns; nested ones add noise
    const scope = currentScope(stack);
    if (scope !== "module") return;

    const l = loc(node.span);
    const names: string[] = [];

    if (node.type === "ObjectPattern") {
      for (const prop of node.properties ?? []) {
        const k = prop.key?.name ?? prop.key?.value;
        if (k) names.push(k);
      }
    } else {
      for (const el of node.elements ?? []) {
        if (el?.type === "Identifier") names.push(el.name);
      }
    }

    nodes.push({
      id: makeId(filePath, l, node.type),
      intent: "definition",
      name: names.join(", ") || node.type,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: node.type,
        scope,
        names,
      },
    });
  };

/**
 * Program and module visitors 
 */

/**
 * Root program node 
 * @param param0 
 * @returns 
 */
export const programVisitor =
  ({ filePath, nodes, loc }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    nodes.push({
      id: makeId(filePath, loc(node.span), "Program"),
      intent: "definition",
      name: "module",
      location: loc(node.span),
      weight: WEIGHTS.module,
      metadata: {
        nodeType: "Program",
        scope: "module",
        sourceType: node.sourceType, // "module" | "script"
      },
    });
  };

/**
 * Export named declarations 
 * @param param0 
 * @returns 
 */
export const exportNamedDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    for (const specifier of node.specifiers ?? []) {
      nodes.push({
        id: makeId(filePath, l, "ExportNamedDeclaration"),
        intent: "export",
        name: specifier.exported?.name ?? specifier.local?.name ?? "unknown",
        target: specifier.local?.name,
        location: l,
        weight: WEIGHTS.export,
        metadata: {
          nodeType: "ExportNamedDeclaration",
          scope: currentScope(stack),
          exportKind: node.exportKind ?? "value",
        },
      });
    }
  };

/**
 * Export Default declarations visitors
 * @param param0 
 * @returns 
 */
export const exportDefaultDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = 
      node.declaration?.name ??
      node.declaration?.id?.name ??
      node.declaration?.type ??
      "default";
    
    nodes.push({
      id: makeId(filePath, l, "ExportDefaultDeclaration"),
      intent: "export",
      name: "default",
      target: name,
      location: l,
      weight: WEIGHTS.export,
      metadata: {
        nodeType: "ExportDefaultDeclaration",
        scope: currentScope(stack),
        exportKind: node.exportKind ?? "value",
        isDefault: true,
      },
    });
  };

/**
 * Export All declarations
 * @param param0 
 * @returns 
 */
export const exportAllDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "ExportAllDeclaration"),
      intent: "export",
      name: node.source?.value ?? "*",
      target: node.source?.value,
      location: l,
      weight: WEIGHTS.export,
      metadata: {
        nodeType: "ExportAllDeclaration",
        scope: currentScope(stack),
        exportKind: node.exportKind ?? "value",
      },
    });
};

/**
 * Import declaration visitor (handles both ES6 `import` and TypeScript `import type`).
 * @param param0 
 * @returns 
 */

export const importDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const importKind = node.importKind ?? "value";
    
    for (const specifier of node.specifiers ?? []) {
      const name = 
        specifier.local?.name ??
        specifier.imported?.name ??
        "unknown";
      
      const target = 
        specifier.imported?.name ??
        specifier.local?.name ??
        node.source?.value;
      
      nodes.push({
        id: makeId(filePath, l, "ImportDeclaration"),
        intent: "import",
        name,
        target,
        location: l,
        weight: WEIGHTS.import,
        metadata: {
          nodeType: "ImportDeclaration",
          scope: currentScope(stack),
          importKind,
          source: node.source?.value,
          specifierType: specifier.type, // ImportSpecifier, ImportDefaultSpecifier, etc.
        },
      });
    }
};

/**
 * Control flow visitors (if statements, loops, etc.) could be added here if needed for advanced analysis.
 */

/**
 * If statement visitor
 * @param param0 
 * @returns 
 */
export const ifStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "IfStatement"),
      intent: "definition",
      name: "if",
      location: l,
      weight: WEIGHTS.if,
      metadata: {
        nodeType: "IfStatement",
        scope: currentScope(stack),
      },
    });
};

/**
 * for statement visitor
 * @param param0 
 * @returns 
 */
export const forStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "ForStatement"),
      intent: "definition",
      name: "for",
      location: l,
      weight: WEIGHTS.for,
      metadata: {
        nodeType: "ForStatement",
        scope: currentScope(stack),
        isAwait: node.await ?? false, // for await...of
      },
    });
};

/**
 * while statement visitor
 * @param param0 
 * @returns 
 */
export const whileStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "WhileStatement"),
      intent: "definition",
      name: "while",
      location: l,
      weight: WEIGHTS.while,
      metadata: {
        nodeType: "WhileStatement",
        scope: currentScope(stack),
      },
    });
};

/**
 * switch statement visitor
 * @param param0 
 * @returns 
 */
export const switchStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "SwitchStatement"),
      intent: "definition",
      name: "switch",
      location: l,
      weight: WEIGHTS.switch,
      metadata: {
        nodeType: "SwitchStatement",
        scope: currentScope(stack),
      },
    });
};

/**
 * try statement visitor
 * @param param0 
 * @returns 
 */
export const tryStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TryStatement"),
      intent: "definition",
      name: "try",
      location: l,
      weight: WEIGHTS.try,
      metadata: {
        nodeType: "TryStatement",
        scope: currentScope(stack),
        hasCatch: !!node.handler,
        hasFinally: !!node.finalizer,
      },
    });
};

/**
 * More Expressions
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
      weight: WEIGHTS.constructor,
      metadata: {
        nodeType: "NewExpression",
        scope: currentScope(stack),
        callee: target,
      },
    });
  };

export const memberExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    // Only capture important member expressions (e.g., static class members)
    if (!node.computed && node.property?.name) {
      const l = loc(node.span);
      const object = serializeExpr(node.object);
      const property = node.property.name;
      
      nodes.push({
        id: makeId(filePath, l, "MemberExpression"),
        intent: "call",
        name: property,
        target: `${object}.${property}`,
        location: l,
        weight: WEIGHTS.callback,
        metadata: {
          nodeType: "MemberExpression",
          scope: currentScope(stack),
          computed: false,
          optional: node.optional ?? false,
        },
      });
    }
  };

export const conditionalExpressionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "ConditionalExpression"),
      intent: "definition",
      name: "ternary",
      location: l,
      weight: WEIGHTS.ternary,
      metadata: {
        nodeType: "ConditionalExpression",
        scope: currentScope(stack),
      },
    });
  };

  /**
   * More ts visitors
   */

  export const tsInterfaceDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSInterfaceDeclaration"),
      intent: "definition",
      name: node.id?.name ?? ident(node.id),
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSInterfaceDeclaration",
        scope: currentScope(stack),
        exportKind: node.exportKind ?? "type",
        isDeclare: node.declare ?? false,
        extends: node.extends?.map((e: any) => serializeExpr(e.expression ?? e)) ?? [],
      },
    });
  };

export const tsTypeAliasDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSTypeAliasDeclaration"),
      intent: "definition",
      name: node.id?.name ?? ident(node.id),
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSTypeAliasDeclaration",
        scope: currentScope(stack),
        exportKind: node.exportKind ?? "type",
        isDeclare: node.declare ?? false,
        typeParameters: node.typeParameters?.params?.length ?? 0,
      },
    });
  };

export const tsEnumDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSEnumDeclaration"),
      intent: "definition",
      name: node.id?.name ?? ident(node.id),
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSEnumDeclaration",
        scope: currentScope(stack),
        exportKind: node.exportKind ?? "value",
        isConst: node.const ?? false,
        isDeclare: node.declare ?? false,
        members: node.members?.map((m: any) => m.id?.name ?? m.name) ?? [],
      },
    });
  };

export const tsEnumMemberVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.id?.name ?? node.name ?? node.computed?.name ?? "unknown";
    nodes.push({
      id: makeId(filePath, l, "TSEnumMember"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "TSEnumMember",
        scope: currentScope(stack),
        isComputed: node.computed ?? false,
      },
    });
};

/**
 * Miscellaneous visitors
 */
export const debuggerStatementVisitor =
({ filePath, nodes, loc, currentScope }: VisitorContext) =>
(node: any, stack: readonly ScopeKind[]) => {
  const l = loc(node.span);
  nodes.push({
    id: makeId(filePath, l, "DebuggerStatement"),
    intent: "definition",
    name: "debugger",
    location: l,
    weight: WEIGHTS.debug,
    metadata: {
      nodeType: "DebuggerStatement",
      scope: currentScope(stack),
    },
  });
};

export const withStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "WithStatement"),
      intent: "definition",
      name: "with",
      location: l,
      weight: WEIGHTS.log,
      metadata: {
        nodeType: "WithStatement",
        scope: currentScope(stack),
      },
    });
};

export const labeledStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "LabeledStatement"),
      intent: "definition",
      name: node.label?.name ?? "label",
      location: l,
      weight: WEIGHTS.for,
      metadata: {
        nodeType: "LabeledStatement",
        scope: currentScope(stack),
      },
    });
};

export const throwStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "ThrowStatement"),
      intent: "definition",
      name: "throw",
      location: l,
      weight: WEIGHTS.throw,
      metadata: {
        nodeType: "ThrowStatement",
        scope: currentScope(stack),
      },
    });
};


// Regular function declarations (non-generator)
export const functionDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    if (node.generator) return; // Skip generators (handled elsewhere)
    if (!node.id) return;
    
    const l = loc(node.span);
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
        isGenerator: false,
        parameters: extractParams(node.params ?? []),
        returnType: serializeType(node.returnType?.typeAnnotation),
      },
    });
  };

// Class declarations
export const classDeclarationVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "ClassDeclaration"),
      intent: "definition",
      name: node.id?.name ?? "anonymous",
      location: l,
      weight: WEIGHTS.class,
      metadata: {
        nodeType: "ClassDeclaration",
        scope: currentScope(stack),
        isAbstract: node.abstract ?? false,
        isDeclare: node.declare ?? false,
        superClass: node.superClass ? serializeExpr(node.superClass) : undefined,
        implements: node.implements?.map((i: any) => serializeExpr(i.expression ?? i)) ?? [],
        typeParameters: node.typeParameters?.params?.length ?? 0,
      },
    });
};

// Class methods
export const methodDefinitionVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.key?.name ?? node.key?.value ?? serializeExpr(node.key) ?? "unknown";
    
    nodes.push({
      id: makeId(filePath, l, "MethodDefinition"),
      intent: "definition",
      name,
      location: l,
      weight: node.kind === "constructor" ? WEIGHTS.constructor : WEIGHTS.method,
      metadata: {
        nodeType: "MethodDefinition",
        scope: currentScope(stack),
        kind: node.kind, // "constructor" | "method" | "get" | "set"
        visibility: node.accessibility === "private" ? "private" : 
                    node.accessibility === "protected" ? "protected" : "public",
        isStatic: node.static ?? false,
        isAsync: node.value?.async ?? false,
        isGenerator: node.value?.generator ?? false,
        isAbstract: node.abstract ?? false,
        isOptional: node.optional ?? false,
        parameters: extractParams(node.value?.params ?? []),
        returnType: serializeType(node.value?.returnType?.typeAnnotation),
      },
    });
};

/**
 * More advanced TypeScript visitors for type predicates, mapped types, template literal types, and import types.
 * These capture more nuanced type-level constructs that can be important for understanding complex type relationships.
 * @param ctx 
 * @returns 
 */
// Type predicates: function isFish(pet): pet is Fish {}
export const tsTypePredicateVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSTypePredicate"),
      intent: "definition",
      name: node.parameterName?.name ?? "type-predicate",
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSTypePredicate",
        scope: currentScope(stack),
        asserts: node.asserts ?? false,
        typeAnnotation: serializeType(node.typeAnnotation?.typeAnnotation),
      },
    });
  };

// Mapped types: { [P in keyof T]: T[P] }
export const tsMappedTypeVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSMappedType"),
      intent: "definition",
      name: node.typeParameter?.name ?? "mapped-type",
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSMappedType",
        scope: currentScope(stack),
        readonly: node.readonly,
        optional: node.optional,
      },
    });
  };

// Template literal types: `Hello ${World}`
export const tsTemplateLiteralTypeVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSTemplateLiteralType"),
      intent: "definition",
      name: node.quasis?.map((q: any) => q.value.raw).join("${}") ?? "template-literal",
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSTemplateLiteralType",
        scope: currentScope(stack),
      },
    });
  };

// Import types: import('./module').Type
export const tsImportTypeVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "TSImportType"),
      intent: "import",
      name: node.argument?.value ?? "import-type",
      target: node.argument?.value,
      location: l,
      weight: WEIGHTS.type,
      metadata: {
        nodeType: "TSImportType",
        scope: currentScope(stack),
        qualifier: node.qualifier ? serializeExpr(node.qualifier) : undefined,
      },
    });
  };

/**
 * Metaprogramming patterns like rest elements, assignment patterns, meta properties, and private identifiers.
 * These capture more dynamic constructs that can be important for understanding code behavior, especially in modern JavaScript and TypeScript.
 */
// Rest elements: ...rest
export const restElementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.argument?.name ?? "rest";
    
    nodes.push({
      id: makeId(filePath, l, "RestElement"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "RestElement",
        scope: currentScope(stack),
      },
    });
  };

// Assignment patterns: (a = 1) => {}
export const assignmentPatternVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.left?.name ?? "assignment-pattern";
    
    nodes.push({
      id: makeId(filePath, l, "AssignmentPattern"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "AssignmentPattern",
        scope: currentScope(stack),
        hasDefault: true,
      },
    });
  };

/**
 * 
 * @param ctx 
 * @returns 
 */
// Meta properties: import.meta, new.target
export const metaPropertyVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    const name = node.meta?.name && node.property?.name ? 
                 `${node.meta.name}.${node.property.name}` : "meta";
    
    nodes.push({
      id: makeId(filePath, l, "MetaProperty"),
      intent: "definition",
      name,
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "MetaProperty",
        scope: currentScope(stack),
      },
    });
  };

// Private fields access: #field
export const privateIdentifierVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "PrivateIdentifier"),
      intent: "definition",
      name: node.name ?? "#private",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "PrivateIdentifier",
        scope: currentScope(stack),
        visibility: "private",
      },
    });
  };


/**
 * Special statements like "use strict" directives and empty statements (semicolons) that don't fit traditional categories but can be important for understanding code behavior.
 */
// "use strict" directives
export const directiveVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "Directive"),
      intent: "definition",
      name: node.value?.value ?? "directive",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "Directive",
        scope: currentScope(stack),
      },
    });
  };

// Empty statements: ;
export const emptyStatementVisitor =
  ({ filePath, nodes, loc, currentScope }: VisitorContext) =>
  (node: any, stack: readonly ScopeKind[]) => {
    const l = loc(node.span);
    nodes.push({
      id: makeId(filePath, l, "EmptyStatement"),
      intent: "definition",
      name: "empty",
      location: l,
      weight: WEIGHTS.declare,
      metadata: {
        nodeType: "EmptyStatement",
        scope: currentScope(stack),
      },
    });
  };
// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a complete ScopedVisitor map merging the original visitors
 * (from visitors.ts) with all the additional ones defined in this file.
 *
 * Usage:
 *   import { buildVisitorMap } from "./visitors-additional";
 *   const visitor = buildVisitorMap(ctx, originalVisitors);
 *   walkScoped(ast, visitor);
 */
export const buildAdditionalVisitors = (ctx: VisitorContext) => ({
  // Program & Module 
  Program: programVisitor(ctx),
  ExportNamedDeclaration: exportNamedDeclarationVisitor(ctx),
  ExportDefaultDeclaration: exportDefaultDeclarationVisitor(ctx),
  ExportAllDeclaration: exportAllDeclarationVisitor(ctx),
  ImportDeclaration: importDeclarationVisitor(ctx),

  // Functions & Classes
  FunctionDeclaration: functionDeclarationVisitor(ctx), // Replace the generator-only one
  ClassDeclaration: classDeclarationVisitor(ctx),
  MethodDefinition: methodDefinitionVisitor(ctx),

  // Control Flow 
  IfStatement: ifStatementVisitor(ctx),
  ForStatement: forStatementVisitor(ctx),
  WhileStatement: whileStatementVisitor(ctx),
  DoWhileStatement: whileStatementVisitor(ctx),
  SwitchStatement: switchStatementVisitor(ctx),
  TryStatement: tryStatementVisitor(ctx),

  // Expressions 
  CallExpression: newExpressionVisitor(ctx),
  NewExpression: newExpressionVisitor(ctx),
  MemberExpression: memberExpressionVisitor(ctx),
  ConditionalExpression: conditionalExpressionVisitor(ctx),
  MetaProperty: metaPropertyVisitor(ctx),

  // TypeScript Advanced 
  TSTypePredicate: tsTypePredicateVisitor(ctx),
  TSMappedType: tsMappedTypeVisitor(ctx),
  TSTemplateLiteralType: tsTemplateLiteralTypeVisitor(ctx),
  TSImportType: tsImportTypeVisitor(ctx),

  // Patterns 
  RestElement: restElementVisitor(ctx),
  AssignmentPattern: assignmentPatternVisitor(ctx),
  PrivateIdentifier: privateIdentifierVisitor(ctx),

  // Directives 
  Directive: directiveVisitor(ctx),
  EmptyStatement: emptyStatementVisitor(ctx),

  // Old visitors
  TSInterfaceDeclaration: tsInterfaceDeclarationVisitor(ctx),
  TSTypeAliasDeclaration: tsTypeAliasDeclarationVisitor(ctx),
  TSEnumDeclaration: tsEnumDeclarationVisitor(ctx),
  TSEnumMember: tsEnumMemberVisitor(ctx),
  TSModuleDeclaration: tsModuleDeclarationVisitor(ctx),
  TSImportEqualsDeclaration: tsImportEqualsDeclarationVisitor(ctx),
  TSExportAssignment: tsExportAssignmentVisitor(ctx),
  TSNamespaceExportDeclaration: tsNamespaceExportDeclarationVisitor(ctx),
  TSConstructSignatureDeclaration: tsConstructSignatureDeclarationVisitor(ctx),
  TSCallSignatureDeclaration: tsCallSignatureDeclarationVisitor(ctx),
  TSIndexSignature: tsIndexSignatureVisitor(ctx),
  TSMethodSignature: tsMethodSignatureVisitor(ctx),
  TSPropertySignature: tsPropertySignatureVisitor(ctx),
  TSTypeAssertion: tsTypeAssertionVisitor(ctx),

  // Keep your JSX visitors
  JSXOpeningElement: jsxOpeningElementVisitor(ctx),
  JSXFragment: jsxFragmentVisitor(ctx),
  JSXSpreadAttribute: jsxSpreadAttributeVisitor(ctx),

  // Keep expression visitors
  TaggedTemplateExpression: taggedTemplateExpressionVisitor(ctx),
  AwaitExpression: awaitExpressionVisitor(ctx),
  YieldExpression: yieldExpressionVisitor(ctx),
  AssignmentExpression: assignmentExpressionVisitor(ctx),
  ImportExpression: importExpressionVisitor(ctx),

  // Keep decorators and patterns
  Decorator: decoratorVisitor(ctx),
  ObjectPattern: destructuringPatternVisitor(ctx),
  ArrayPattern: destructuringPatternVisitor(ctx),

  // Keep class members
  PropertyDefinition: propertyDefinitionVisitor(ctx),
  StaticBlock: staticBlockVisitor(ctx),
});
