// test/semantic-validator.test.ts
import * as assert from "assert";
import { SemanticValidator, ValidatorFactory } from "../../src/core/Validator.js";
import type { SemanticNode } from "../../src/contract/Graph.js";
import path from 'node:path';
import fs from 'fs';

// Create validator with test JSON files
const basePath = path.join(__dirname, "../../../src/definintions/base-intents.json");
const jsPath = path.join(__dirname, "../../../src/definintions/javascript-intents.json");

const validNode = {
    id: 'src/app.ts:10:25:import.React',
    intent: 'import',
    name: 'React',
    location: {
        start: { line: 10, column: 0 },
        end: { line: 10, column: 25 }
    },
    weight: 0.9,
    target: 'react',
    metadata: {
        nodeType: 'ImportDeclaration',
        importKind: 'value',
        isDefault: true,
        specifiers: ['React']
    }
} as SemanticNode;

suite("SemanticValidator - Base Intent Validation", () => {
    let validator: SemanticValidator;

    setup(() => {
 
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);


    });

    test("Valid node should pass validation", () => {
        const issues = validator.validateNode(validNode, 'typescriptreact');
        assert.strictEqual(issues.length, 0);
    });

    test("Missing required field should return error", () => {
        const invalidNode = { ...validNode, id: undefined };
        const issues = validator.validateNode(invalidNode as any, 'typescriptreact');
        
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'required-field');
        assert.ok(issues[0].message.includes('id'));
    });

    test("Invalid ID pattern should return error", () => {
        const invalidNode = { ...validNode, id: 'invalid-id' };
        const issues = validator.validateNode(invalidNode, 'typescriptreact');
        
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'id-format');
    });

    test("Invalid intent should return error", () => {
        // cast type to bypass TypeScript checks since intent is a string enum
        const invalidNode = { ...validNode, intent: 'invalid-intent' } as unknown as SemanticNode;
        const issues = validator.validateNode(invalidNode, 'typescriptreact');
        
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'intent-resolution');
    });

    test("Weight outside range should return error", () => {
        const invalidNode = { ...validNode, weight: 1.5 };
        const issues = validator.validateNode(invalidNode, 'typescriptreact');
        
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'weight-range');
    });

    test("Missing target for required intent should return error", () => {
        const invalidNode = { ...validNode, target: undefined };
        const issues = validator.validateNode(invalidNode, 'typescriptreact');
        
        assert.strictEqual(issues.length, 3);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'target-required');
    });

    test("Location with negative line should return error", () => {
        const invalidNode = {
            ...validNode,
            location: {
                start: { line: -1, column: 0 },
                end: { line: 10, column: 25 }
            }
        };
        const issues = validator.validateNode(invalidNode, 'typescriptreact');
        
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'location-non-negative');
    });

    test("Location with end before start should return error", () => {
        const invalidNode = {
            ...validNode,
            location: {
                start: { line: 20, column: 0 },
                end: { line: 10, column: 25 }
            }
        };
        const issues = validator.validateNode(invalidNode, 'typescriptreact');
        
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'location-order');
    });
});

suite("SemanticValidator - Extended Intent Validation", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("Valid extended intent should pass validation", () => {
        const node: SemanticNode = {
            id: 'src/types.ts:5:18:type_import.UserType',
            intent: 'import',
            name: 'UserType',
            location: {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 18 }
            },
            weight: 0.8,
            target: './types',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'type',
                intentSource: 'extended',
                specifiers: ['UserType']
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        console.log("ISSUES", issues);
       if (issues.length > 0) {
         for (const issue of issues) {
            assert.ok(issue.type === "warning");
        }
       } else {
        assert.strictEqual(issues.length, 0);
       }

    });

    test("Extended intent without metadata.intentSource should return warning", () => {
        const node: SemanticNode = {
            id: 'src/types.ts:5:18:type_import.UserType',
            intent: 'import',
            name: 'UserType',
            location: {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 18 }
            },
            weight: 0.8,
            target: './types',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'type',
                specifiers: ['UserType']
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        assert.strictEqual(issues.length, 2);
        assert.strictEqual(issues[0].type, 'warning');
        assert.strictEqual(issues[0].rule, 'type-import-preference');
    });

    test("Extended intent with wrong metadata.intentSource should return warning", () => {
        const node: SemanticNode = {
            id: 'src/types.ts:5:18:type_import.UserType',
            intent: 'import',
            name: 'UserType',
            location: {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 18 }
            },
            weight: 0.8,
            target: './types',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'type',
                intentSource: 'base',
                specifiers: ['UserType']
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        assert.strictEqual(issues.length, 2);
        assert.strictEqual(issues[0].type, 'warning');
        assert.strictEqual(issues[0].rule, 'type-import-preference');
    });
});

suite("SemanticValidator - AST Node Mapping", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("AST node should map to correct intent", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:10:25:import.React',
            intent: 'import',
            name: 'React',
            location: {
                start: { line: 10, column: 0 },
                end: { line: 10, column: 25 }
            },
            weight: 0.9,
            target: 'react',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'value'
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        assert.strictEqual(issues.length, 0);
    });

    test("AST node with wrong intent should return error", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:10:25:call.React',
            intent: 'call',
            name: 'React',
            location: {
                start: { line: 10, column: 0 },
                end: { line: 10, column: 25 }
            },
            weight: 0.9,
            target: 'react',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'value'
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        assert.strictEqual(issues.length, 2);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'ast-node-mapping');
        assert.ok(issues[0].message.includes('ImportDeclaration should map to intent'));
    });

});

suite("SemanticValidator - Metadata Schema Validation", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("Required metadata field missing should return error", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:10:25:import.React',
            intent: 'import',
            name: 'React',
            location: {
                start: { line: 10, column: 0 },
                end: { line: 10, column: 25 }
            },
            weight: 0.9,
            target: 'react',
            metadata: {
                nodeType: 'ImportDeclaration'
                // Missing importKind which is REQUIRED
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].type, 'error');
        assert.strictEqual(issues[0].rule, 'metadata-required');
        assert.ok(issues[0].message.includes('importKind'));
    });

    test("Call node without callee should return warning", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:15:20:call.fetchData',
            intent: 'call',
            name: 'fetchData',
            location: {
                start: { line: 15, column: 0 },
                end: { line: 15, column: 20 }
            },
            weight: 0.3,
            target: 'fetchData',
            metadata: {
                nodeType: 'CallExpression'
                // Missing callee
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        // This would be caught by metadata schema validation
        const metadataIssues = issues.filter(i => i.rule === 'metadata-required');
        assert.strictEqual(metadataIssues.length, 1);
    });
});

suite("SemanticValidator - Language Specific Rules", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("require() as call should return error", () => {
        const node: SemanticNode = {
            id: 'src/utils.ts:5:18:call.require',
            intent: 'call',
            name: 'require',
            location: {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 18 }
            },
            weight: 0.3,
            target: 'fs',
            metadata: {
                nodeType: 'CallExpression',
                isCJS: true
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const ruleIssues = issues.filter(i => i.rule === 'require-as-import');
        assert.strictEqual(ruleIssues.length, 1);
        assert.strictEqual(ruleIssues[0].type, 'error');
    });

    test("Intrinsic JSX element with wrong weight should return warning", () => {
        const node: SemanticNode = {
            id: 'src/components/App.tsx:10:5:call.div',
            intent: 'call',
            name: 'div',
            location: {
                start: { line: 10, column: 0 },
                end: { line: 10, column: 5 }
            },
            weight: 0.5, // Should be 0.15
            target: 'div',
            metadata: {
                nodeType: 'JSXElement',
                isIntrinsic: true
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const ruleIssues = issues.filter(i => i.rule === 'jsx-intrinsic-weight');
        assert.strictEqual(ruleIssues.length, 1);
        assert.strictEqual(ruleIssues[0].type, 'warning');
    });

    test("Type import using base import should return warning", () => {
        const node: SemanticNode = {
            id: 'src/types.ts:5:18:import.UserType',
            intent: 'import',
            name: 'UserType',
            location: {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 18 }
            },
            weight: 0.8,
            target: './types',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'type',
                specifiers: ['UserType']
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const ruleIssues = issues.filter(i => i.rule === 'type-import-preference');
        assert.strictEqual(ruleIssues.length, 1);
        assert.strictEqual(ruleIssues[0].type, 'warning');
    });

    test("Type export using base export should return warning", () => {
        const node: SemanticNode = {
            id: 'src/types.ts:8:15:export.UserType',
            intent: 'export',
            name: 'UserType',
            location: {
                start: { line: 8, column: 0 },
                end: { line: 8, column: 15 }
            },
            weight: 0.8,
            metadata: {
                nodeType: 'ExportNamedDeclaration',
                exportKind: 'type',
                specifiers: ['UserType']
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const ruleIssues = issues.filter(i => i.rule === 'type-export-preference');
        assert.strictEqual(ruleIssues.length, 1);
        assert.strictEqual(ruleIssues[0].type, 'warning');
    });
});

suite("SemanticValidator - Weight Overrides", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("Constructor call with non-recommended weight should return warning", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:12:15:new.UserService',
            intent: 'call',
            name: 'UserService',
            location: {
                start: { line: 12, column: 0 },
                end: { line: 12, column: 15 }
            },
            weight: 0.3, // Should be 0.4 for constructors
            target: 'UserService',
            metadata: {
                nodeType: 'NewExpression',
                isConstructor: true
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const overrideIssues = issues.filter(i => i.rule === 'weight-override');
        assert.strictEqual(overrideIssues.length, 1);
        assert.strictEqual(overrideIssues[0].type, 'warning');
    });

    test("Type import with non-recommended weight should return warning", () => {
        const node: SemanticNode = {
            id: 'src/types.ts:5:18:type_import.UserType',
            intent: 'import',
            name: 'UserType',
            location: {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 18 }
            },
            weight: 0.9, // Should be 0.6 for type imports
            target: './types',
            metadata: {
                nodeType: 'ImportDeclaration',
                importKind: 'type',
                intentSource: 'extended'
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const overrideIssues = issues.filter(i => i.rule === 'weight-override');
        assert.strictEqual(overrideIssues.length, 1);
        assert.strictEqual(overrideIssues[0].type, 'warning');
    });

    test("Built-in type reference with non-recommended weight should return warning", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:15:20:reference.Promise',
            intent: 'reference',
            name: 'Promise',
            location: {
                start: { line: 15, column: 0 },
                end: { line: 15, column: 20 }
            },
            weight: 0.2, // Should be 0.05 for built-ins
            target: 'Promise',
            metadata: {
                nodeType: 'TSTypeReference',
                isBuiltin: true
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const overrideIssues = issues.filter(i => i.rule === 'weight-override');
        assert.strictEqual(overrideIssues.length, 1);
        assert.strictEqual(overrideIssues[0].type, 'warning');
    });

    test("Chained call with non-recommended weight should return warning", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:20:25:call.map',
            intent: 'call',
            name: 'map',
            location: {
                start: { line: 20, column: 0 },
                end: { line: 20, column: 25 }
            },
            weight: 0.3, // Should be 0.25 for chained calls
            target: 'map',
            metadata: {
                nodeType: 'CallExpression',
                isChained: true
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        const overrideIssues = issues.filter(i => i.rule === 'weight-override');
        assert.strictEqual(overrideIssues.length, 1);
        assert.strictEqual(overrideIssues[0].type, 'warning');
    });
});

suite("SemanticValidator - Multiple Node Validation", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("validateAll should return correct statistics", () => {
        const nodes: SemanticNode[] = [
            // Valid node
            {
                id: 'src/app.ts:10:25:import.React',
                intent: 'import',
                name: 'React',
                location: {
                    start: { line: 10, column: 0 },
                    end: { line: 10, column: 25 }
                },
                weight: 0.9,
                target: 'react',
                metadata: {
                    nodeType: 'ImportDeclaration',
                    importKind: 'value'
                }
            },
            // Invalid node (missing required field)
            {
                id: 'src/utils.ts:5:18:export.helper',
                intent: 'export',
                name: 'helper',
                location: {
                    start: { line: 5, column: 0 },
                    end: { line: 5, column: 18 }
                },
                weight: 0.8,
                // Missing metadata intentionally
            } as unknown as SemanticNode,
            // Node with warning
            {
                id: 'src/components/App.tsx:15:5:call.div',
                intent: 'call',
                name: 'div',
                location: {
                    start: { line: 15, column: 0 },
                    end: { line: 15, column: 5 }
                },
                weight: 0.5, // Wrong weight for intrinsic
                target: 'div',
                metadata: {
                    nodeType: 'JSXElement',
                    isIntrinsic: true
                }
            }
        ];

        const report = validator.validateAll(nodes, 'typescriptreact');
        
        assert.strictEqual(report.isValid, false);
        assert.strictEqual(report.stats.totalNodes, 3);
        assert.strictEqual(report.stats.validNodes, 2);
        assert.strictEqual(report.stats.invalidNodes, 1);
        assert.ok(report.stats.warnings >= 1);
        assert.ok(report.issues.length > 0);
    });

    test("validateAll with all valid nodes should return isValid true", () => {
        const nodes: SemanticNode[] = [
            {
                id: 'src/app.ts:10:25:import.React',
                intent: 'import',
                name: 'React',
                location: {
                    start: { line: 10, column: 0 },
                    end: { line: 10, column: 25 }
                },
                weight: 0.9,
                target: 'react',
                metadata: {
                    nodeType: 'ImportDeclaration',
                    importKind: 'value'
                }
            },
            {
                id: 'src/app.ts:12:20:export.Component',
                intent: 'export',
                name: 'Component',
                location: {
                    start: { line: 12, column: 0 },
                    end: { line: 12, column: 20 }
                },
                weight: 0.8,
                metadata: {
                    nodeType: 'ExportDefaultDeclaration',
                    exportKind: 'value'
                }
            }
        ];

        const report = validator.validateAll(nodes, 'typescriptreact');
        
        assert.strictEqual(report.isValid, true);
        assert.strictEqual(report.stats.validNodes, 2);
        assert.strictEqual(report.stats.invalidNodes, 0);
        assert.strictEqual(report.issues.length, 0);
    });
});

suite("SemanticValidator - Edge Cases", () => {
    let validator: SemanticValidator;

    setup(() => {
        validator = new SemanticValidator(basePath);
        validator.loadLanguageExtension(jsPath);
    });

    test("Empty node array should return valid report with zero stats", () => {
        const report = validator.validateAll([], 'typescriptreact');
        
        assert.strictEqual(report.isValid, true);
        assert.strictEqual(report.stats.totalNodes, 0);
        assert.strictEqual(report.stats.validNodes, 0);
        assert.strictEqual(report.stats.invalidNodes, 0);
        assert.strictEqual(report.issues.length, 0);
    });

    test("Node with undefined metadata should not cause errors", () => {
        const node: SemanticNode = {
            id: 'src/app.ts:10:25:import.React',
            intent: 'import',
            name: 'React',
            location: {
                start: { line: 10, column: 0 },
                end: { line: 10, column: 25 }
            },
            weight: 0.9,
            target: 'react',
            metadata: undefined as any
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        // Should still pass basic validation
        assert.strictEqual(issues.length, 0);
    });

    test("Unknown language should still validate basic structure", () => {
        const issues = validator.validateNode(validNode, 'unknown-language');
        
        // Should still validate basic structure even without language extension
        assert.strictEqual(issues.length, 0);
    });

    test("Location with missing end should return error", () => {
        const node: SemanticNode = {
            ...validNode,
            location: {
                start: { line: 10, column: 0 },
                end: undefined as any
            }
        };

        const issues = validator.validateNode(node, 'typescriptreact');
        assert.strictEqual(issues.length, 1);
        assert.strictEqual(issues[0].rule, 'location-fields');
    });

    test("isExtensionSupported should return correct boolean", () => {
        assert.strictEqual(validator.isExtensionSupported('test.js', 'javascript'), true);
        assert.strictEqual(validator.isExtensionSupported('test.tsx', 'typescriptreact'), true);
        assert.strictEqual(validator.isExtensionSupported('test.py', 'javascript'), false);
        assert.strictEqual(validator.isExtensionSupported('test.js', 'unknown'), false);
    });

    test("getRegisteredLanguages should return all loaded languages", () => {
        const languages = validator.getRegisteredLanguages();
        assert.ok(languages.includes('javascript'));
        assert.ok(languages.includes('typescript'));
        assert.ok(languages.includes('javascriptreact'));
        assert.ok(languages.includes('typescriptreact'));
    });

    test("getValidationSummary should return correct structure", () => {
        const summary = validator.getValidationSummary();
        
        assert.ok(summary.baseIntents);
        assert.ok(summary.baseIntents.version);
        assert.ok(summary.baseIntents.name);
        assert.ok(summary.languageExtensions);
        assert.ok(Array.isArray(summary.languageExtensions));
        assert.ok(summary.extendedIntents);
    });
});

suite("ValidatorFactory", () => {
    test("createWithDefaultConfig should create validator", () => {
        const validator = ValidatorFactory.createWithDefaultConfig();
        assert.ok(validator instanceof SemanticValidator);
    });

    test("createWithPaths should load specified extensions", () => {
        const validator = ValidatorFactory.createWithPaths(basePath, [jsPath]);
        assert.ok(validator instanceof SemanticValidator);
        assert.ok(validator.getRegisteredLanguages().length > 0);
    });

    test("createWithPaths should handle invalid paths gracefully", () => {
        const basePath = path.join(__dirname, "../fixtures/base-intents.json");
        
        // Should not throw
        const validator = ValidatorFactory.createWithPaths(basePath, ['./invalid-path.json']);
        assert.ok(validator instanceof SemanticValidator);
    });
});