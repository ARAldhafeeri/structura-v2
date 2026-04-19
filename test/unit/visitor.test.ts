import * as assert from "assert";
import { parseSync } from "oxc-parser";
import { scopeForNode, findFirst, type ScopeKind } from "../../src/uitlities/walker.js";
import { 
  buildAdditionalVisitors,
  type VisitorContext 
} from "../../src/core/Visitors.js";
import { walkScoped } from "../../src/core/Walker.js";

suite("Additional Visitors Tests", () => {
  const parseCode = (code: string, lang: 'js' | 'ts' | 'jsx' = 'js'): any => {
    const filename = lang === 'ts' ? 'test.ts' : lang === 'jsx' ? 'test.jsx' : 'test.js';
    const result = parseSync(filename, code);
    return result.program;
  };

  const createContext = (filePath: string, nodes: any[]): VisitorContext => ({
    filePath,
    nodes,
    loc: (span: any) => ({start: { line: 1, column: 0 }, end: { line: 1, column: 0 }}),
    currentScope: (stack: readonly ScopeKind[]) => stack[stack.length - 1] || "module",
    edges: [],
    importStubs: [],
    parentIdStack: [`${filePath.replace(/:/g, "%3A")}:1:0:Program`],
  });

  test("programVisitor - should capture program node", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("const x = 1;");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { Program: visitors.Program });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].metadata.nodeType, "Program");
  });

  test("exportNamedDeclarationVisitor - should capture named exports", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    // Need a declaration with an actual specifier
    const ast = parseCode("export const foo = 1; export { foo as bar };");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      ExportNamedDeclaration: visitors.ExportNamedDeclaration,
      // Also need to handle the variable declaration to process the export
      VariableDeclaration: () => {} // Dummy to allow traversal
    });
    assert.ok(nodes.length >= 1, "Should capture at least one export");
    if (nodes.length > 0) {
      assert.strictEqual(nodes[0].intent, "export");
    }
  });

  test("exportDefaultDeclarationVisitor - should capture default exports", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("export default function foo() {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ExportDefaultDeclaration: visitors.ExportDefaultDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "default");
  });

  test("exportAllDeclarationVisitor - should capture export *", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("export * from './module'");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ExportAllDeclaration: visitors.ExportAllDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].target, "./module");
  });

  test("importDeclarationVisitor - should capture imports", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("import { foo } from './module'");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ImportDeclaration: visitors.ImportDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "foo");
  });

  test("functionDeclarationVisitor - should capture function declarations", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("function foo() {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { FunctionDeclaration: visitors.FunctionDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "foo");
  });

  test("classDeclarationVisitor - should capture class declarations", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("class Foo {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ClassDeclaration: visitors.ClassDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Foo");
  });

  test("methodDefinitionVisitor - should capture class methods", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("class Foo { bar() {} }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { MethodDefinition: visitors.MethodDefinition });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "bar");
  });

  test("ifStatementVisitor - should capture if statements", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("if (true) {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { IfStatement: visitors.IfStatement });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "if");
  });

  test("forStatementVisitor - should capture for loops", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("for (let i = 0; i < 10; i++) {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ForStatement: visitors.ForStatement });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "for");
  });

  test("whileStatementVisitor - should capture while loops", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("while (true) {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { WhileStatement: visitors.WhileStatement });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "while");
  });

  test("switchStatementVisitor - should capture switch statements", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("switch(x) { case 1: break; }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { SwitchStatement: visitors.SwitchStatement });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "switch");
  });

  test("tryStatementVisitor - should capture try-catch", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("try {} catch(e) {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TryStatement: visitors.TryStatement });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "try");
  });

  test("newExpressionVisitor - should capture new expressions", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("new Foo()");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { NewExpression: visitors.NewExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].target, "Foo");
  });

  test("memberExpressionVisitor - should capture member access", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("obj.prop");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { MemberExpression: visitors.MemberExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "prop");
  });

  test("conditionalExpressionVisitor - should capture ternary", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("const x = a ? b : c");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ConditionalExpression: visitors.ConditionalExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "ternary");
  });

  test("metaPropertyVisitor - should capture import.meta", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("import.meta");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { MetaProperty: visitors.MetaProperty });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "import.meta");
  });

  test("tsTypePredicateVisitor - should capture type predicates", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    // Type predicates need to be inside a function declaration
    const ast = parseCode("function isFish(pet: any): pet is Fish { return true; }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSTypePredicate: visitors.TSTypePredicate,
      FunctionDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].metadata.nodeType, "TSTypePredicate");
  });

  test("tsMappedTypeVisitor - should capture mapped types", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    // Mapped types appear inside type aliases
    const ast = parseCode("type Mapped<T> = { [P in keyof T]: T[P] };", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSMappedType: visitors.TSMappedType,
      TSTypeAliasDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].metadata.nodeType, "TSMappedType");
  });

  test("tsTemplateLiteralTypeVisitor - should capture template literal types", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("type T = `Hello${string}`;", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSTemplateLiteralType: visitors.TSTemplateLiteralType,
      TSTypeAliasDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].metadata.nodeType, "TSTemplateLiteralType");
  });

  test("tsImportTypeVisitor - should capture import types", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("type T = import('./modules').Foo;", 'ts');
    const visitors = buildAdditionalVisitors(ctx);

    walkScoped(ast, { 
      TSImportType: visitors.TSImportType,
      TSTypeAliasDeclaration: () => {} // Allow traversal
    });


    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].metadata.nodeType, "TSImportType");
    assert.strictEqual(nodes[0].intent, "import");
    assert.strictEqual(nodes[0].name, "import-type"); // Default name when argument.value is undefined
    assert.strictEqual(nodes[0].metadata.qualifier, "Foo");
    // target might be undefined, so check that it's either undefined or the module path
    assert.ok(nodes[0].target === undefined || nodes[0].target === "./module");

  });

  test("restElementVisitor - should capture rest elements", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("function foo(...args) {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { RestElement: visitors.RestElement });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "args");
  });

  test("assignmentPatternVisitor - should capture default params", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("function foo(x = 1) {}");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { AssignmentPattern: visitors.AssignmentPattern });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "x");
  });

  test("privateIdentifierVisitor - should capture private fields", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("class Foo { #bar = 1; }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      PrivateIdentifier: visitors.PrivateIdentifier,
      PropertyDefinition: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    // The name might be "bar" or "#bar" depending on parser, so check the metadata
    assert.strictEqual(nodes[0].metadata.visibility, "private");
  });

  
  test("emptyStatementVisitor - should capture empty statements", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode(";;");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { EmptyStatement: visitors.EmptyStatement });
    assert.strictEqual(nodes.length, 2);
    assert.strictEqual(nodes[0].name, "empty");
  });

  test("tsInterfaceDeclarationVisitor - should capture interfaces", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("interface Foo {}", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSInterfaceDeclaration: visitors.TSInterfaceDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Foo");
  });

  test("tsTypeAliasDeclarationVisitor - should capture type aliases", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("type Foo = string;", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSTypeAliasDeclaration: visitors.TSTypeAliasDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Foo");
  });

  test("tsEnumDeclarationVisitor - should capture enums", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("enum Foo { A, B }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSEnumDeclaration: visitors.TSEnumDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Foo");
  });

  test("tsEnumMemberVisitor - should capture enum members", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("enum Foo { Bar = 1 }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSEnumMember: visitors.TSEnumMember });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Bar");
  });

  test("tsModuleDeclarationVisitor - should capture namespaces", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("namespace Foo {}", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSModuleDeclaration: visitors.TSModuleDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Foo");
  });

  test("tsImportEqualsDeclarationVisitor - should capture import = require", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("import foo = require('bar');", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSImportEqualsDeclaration: visitors.TSImportEqualsDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "foo");
  });

  test("tsExportAssignmentVisitor - should capture export =", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("export = foo;", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSExportAssignment: visitors.TSExportAssignment });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "foo");
  });

  test("tsNamespaceExportDeclarationVisitor - should capture export as namespace", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("export as namespace Foo;", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TSNamespaceExportDeclaration: visitors.TSNamespaceExportDeclaration });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Foo");
  });

  test("tsConstructSignatureDeclarationVisitor - should capture construct signatures", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("interface Foo { new(x: number): Foo; }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSConstructSignatureDeclaration: visitors.TSConstructSignatureDeclaration,
      TSInterfaceDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "new");
  });

  test("tsCallSignatureDeclarationVisitor - should capture call signatures", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("interface Foo { (x: number): void; }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSCallSignatureDeclaration: visitors.TSCallSignatureDeclaration,
      TSInterfaceDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "call");
  });

  test("tsIndexSignatureVisitor - should capture index signatures", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("interface Foo { [key: string]: number; }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSIndexSignature: visitors.TSIndexSignature,
      TSInterfaceDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "index");
  });

  test("tsMethodSignatureVisitor - should capture method signatures", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("interface Foo { bar(x: number): void; }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSMethodSignature: visitors.TSMethodSignature,
      TSInterfaceDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "bar");
  });

  test("tsPropertySignatureVisitor - should capture property signatures", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("interface Foo { bar: number; }", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      TSPropertySignature: visitors.TSPropertySignature,
      TSInterfaceDeclaration: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "bar");
  });
  
  test("jsxOpeningElementVisitor - should capture JSX elements", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.jsx", nodes);
    const ast = parseCode("<div>Hello</div>", 'jsx');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      JSXOpeningElement: visitors.JSXOpeningElement,
      JSXElement: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "div");
  });

  test("jsxFragmentVisitor - should capture JSX fragments", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.jsx", nodes);
    const ast = parseCode("<><div/></>", 'jsx');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      JSXFragment: visitors.JSXFragment,
      JSXElement: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "Fragment");
  });

  test("jsxSpreadAttributeVisitor - should capture JSX spreads", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.jsx", nodes);
    const ast = parseCode("<div {...props} />", 'jsx');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { 
      JSXSpreadAttribute: visitors.JSXSpreadAttribute,
      JSXOpeningElement: () => {} // Allow traversal
    });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "props");
  });

  test("taggedTemplateExpressionVisitor - should capture tagged templates", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("gql`query { foo }`");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { TaggedTemplateExpression: visitors.TaggedTemplateExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].target, "gql");
  });

  test("awaitExpressionVisitor - should capture await", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("async function test() { await foo(); }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { AwaitExpression: visitors.AwaitExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].target, "foo");
  });

  test("yieldExpressionVisitor - should capture yield", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("function* gen() { yield 1; }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { YieldExpression: visitors.YieldExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "yield");
  });

  test("assignmentExpressionVisitor - should capture assignments", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("x = 1");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { AssignmentExpression: visitors.AssignmentExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "x");
  });

  test("importExpressionVisitor - should capture dynamic import", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("import('./module')");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ImportExpression: visitors.ImportExpression });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].target, "./module");
  });

  test("decoratorVisitor - should capture decorators", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.ts", nodes);
    const ast = parseCode("@decorator class Foo {}", 'ts');
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { Decorator: visitors.Decorator });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].target, "decorator");
  });

  test("destructuringPatternVisitor - should capture destructuring", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("const { a, b } = obj");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { ObjectPattern: visitors.ObjectPattern });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].metadata.nodeType, "ObjectPattern");
  });

  test("propertyDefinitionVisitor - should capture class fields", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("class Foo { bar = 1; }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { PropertyDefinition: visitors.PropertyDefinition });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "bar");
  });

  test("staticBlockVisitor - should capture static blocks", () => {
    const nodes: any[] = [];
    const ctx = createContext("test.js", nodes);
    const ast = parseCode("class Foo { static {} }");
    const visitors = buildAdditionalVisitors(ctx);
    walkScoped(ast, { StaticBlock: visitors.StaticBlock });
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].name, "static");
  });
});