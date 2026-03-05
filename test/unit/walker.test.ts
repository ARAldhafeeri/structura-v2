import * as assert from "assert";
import { parseSync } from "oxc-parser";
import { scopeForNode, findFirst, type ScopeKind } from "../../src/uitlities/walker.js"; 

suite("Scope Analysis Tests", () => {
  
  // Helper function to parse code and get AST
  const parseCode = (code: string): any => {
    const result = parseSync("test.js", code);
    return result.program;
  };

  suite("scopeForNode Tests", () => {
    test("should return 'function' for function declarations", () => {
      assert.strictEqual(scopeForNode("FunctionDeclaration"), "function");
    });

    test("should return 'function' for function expressions", () => {
      assert.strictEqual(scopeForNode("FunctionExpression"), "function");
    });

    test("should return 'function' for arrow functions", () => {
      assert.strictEqual(scopeForNode("ArrowFunctionExpression"), "function");
    });

    test("should return 'function' for method definitions", () => {
      assert.strictEqual(scopeForNode("MethodDefinition"), "function");
    });

    test("should return 'class' for class declarations", () => {
      assert.strictEqual(scopeForNode("ClassDeclaration"), "class");
    });

    test("should return 'class' for class expressions", () => {
      assert.strictEqual(scopeForNode("ClassExpression"), "class");
    });

    test("should return 'block' for block statements", () => {
      assert.strictEqual(scopeForNode("BlockStatement"), "block");
    });

    test("should return null for non-scope creating nodes", () => {
      assert.strictEqual(scopeForNode("VariableDeclaration"), null);
      assert.strictEqual(scopeForNode("Identifier"), null);
      assert.strictEqual(scopeForNode("Literal"), null);
      assert.strictEqual(scopeForNode("IfStatement"), null);
      assert.strictEqual(scopeForNode("WhileStatement"), null);
    });

    test("should return null for unknown node types", () => {
      assert.strictEqual(scopeForNode("UnknownNodeType"), null);
      assert.strictEqual(scopeForNode(""), null);
    });
  });

  suite("findFirst Tests", () => {
    test("should find function declaration node", () => {
      const ast = parseCode(`
        function test() {
          const x = 1;
        }
      `);

      const result = findFirst(ast, (node) => 
        node.type === "FunctionDeclaration"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "FunctionDeclaration");
      assert.strictEqual(result?.id?.name, "test");
    });

    test("should find class declaration node", () => {
      const ast = parseCode(`
        class MyClass {
          constructor() {}
        }
      `);

      const result = findFirst(ast, (node) => 
        node.type === "ClassDeclaration"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "ClassDeclaration");
      assert.strictEqual(result?.id?.name, "MyClass");
    });

    test("should find arrow function node", () => {
      const ast = parseCode(`
        const arrow = () => {
          return 42;
        };
      `);

      const result = findFirst(ast, (node) => 
        node.type === "ArrowFunctionExpression"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "ArrowFunctionExpression");
    });

    test("should find nested node", () => {
      const ast = parseCode(`
        function outer() {
          function inner() {
            return 'deep';
          }
          return inner();
        }
      `);

      const result = findFirst(ast, (node) => 
        node.type === "FunctionDeclaration" && node.id?.name === "inner"
      );

      assert.ok(result);
      assert.strictEqual(result?.id?.name, "inner");
    });

    test("should return undefined when node not found", () => {
      const ast = parseCode(`
        const x = 42;
      `);

      const result = findFirst(ast, (node) => 
        node.type === "FunctionDeclaration"
      );

      assert.strictEqual(result, undefined);
    });

    test("should handle complex nested structures", () => {
      const ast = parseCode(`
        class Wrapper {
          method() {
            const nested = {
              fn: function() {
                return [1, 2, 3].map(x => x * 2);
              }
            };
          }
        }
      `);

      // Find the arrow function inside map
      const result = findFirst(ast, (node) => 
        node.type === "ArrowFunctionExpression" && 
        node.params?.[0]?.name === "x"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "ArrowFunctionExpression");
    });

    test("should handle array nodes correctly", () => {
      const ast = parseCode(`
        const arr = [
          function() { return 1; },
          function() { return 2; }
        ];
      `);

      const result = findFirst(ast, (node) => 
        node.type === "FunctionExpression"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "FunctionExpression");
    });

    test("should search in object properties", () => {
      const ast = parseCode(`
        const obj = {
          method() {
            return true;
          }
        };
      `);

      const result = findFirst(ast, (node) => 
        node.type === "FunctionExpression"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "FunctionExpression");
    });

    test("should find block statements", () => {
      const ast = parseCode(`
        if (true) {
          const x = 42;
          if (x > 10) {
            console.log('big');
          }
        }
      `);

      const result = findFirst(ast, (node) => 
        node.type === "BlockStatement"
      );

      assert.ok(result);
      assert.strictEqual(result?.type, "BlockStatement");
    });

    test("should handle empty or invalid input gracefully", () => {
      const result1 = findFirst(null, (node) => node.type === "FunctionDeclaration");
      assert.strictEqual(result1, undefined);

      const result2 = findFirst({}, (node) => node.type === "FunctionDeclaration");
      assert.strictEqual(result2, undefined);

      const result3 = findFirst({ type: "Program" }, (node) => node.type === "Program");
      assert.ok(result3);
    });
  });

  suite("Integration Tests: scopeForNode with findFirst", () => {
    test("should find function scope node and verify its kind", () => {
      const ast = parseCode(`
        function test() {}
      `);

      const node = findFirst(ast, (n) => n.type === "FunctionDeclaration");
      assert.ok(node);

      const scopeKind = scopeForNode(node.type);
      assert.strictEqual(scopeKind, "function");
    });

    test("should find class scope node and verify its kind", () => {
      const ast = parseCode(`
        class Test {}
      `);

      const node = findFirst(ast, (n) => n.type === "ClassDeclaration");
      assert.ok(node);

      const scopeKind = scopeForNode(node.type);
      assert.strictEqual(scopeKind, "class");
    });

    test("should find multiple scope nodes in correct order", () => {
      const ast = parseCode(`
        class Container {
          method() {
            if (true) {
              function nested() {}
            }
          }
        }
      `);

      // Should find class first (top-level)
      const first = findFirst(ast, (n) => scopeForNode(n.type) !== null);
      assert.ok(first);
      assert.strictEqual(first.type, "ClassDeclaration");

      // Should find function inside class
      const nestedFunc = findFirst(ast, (n) => 
        n.type === "FunctionDeclaration" && n.id?.name === "nested"
      );
      assert.ok(nestedFunc);
      assert.strictEqual(scopeForNode(nestedFunc.type), "function");
    });

    test("should find block scope inside function", () => {
      const ast = parseCode(`
        function test() {
          {
            let x = 1;
          }
        }
      `);

      const blockNode = findFirst(ast, (n) => n.type === "BlockStatement" && n !== ast.body[0]?.body);
      assert.ok(blockNode);
      assert.strictEqual(scopeForNode(blockNode.type), "block");
    });
  });
});