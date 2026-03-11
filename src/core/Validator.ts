// semantic-validator.ts
import fs from 'fs';
import path from 'path';
import type { SemanticNode, NodeIntent, Scope, SourceLocation, BaseIntentsJson, JavaScriptIntentsJson, ValidationIssue, ValidationReport } from '../contract.js';




/**
 * Validator that loads and uses JSON configurations
 */
export class SemanticValidator {
  private baseIntents: BaseIntentsJson;
  private languageExtensions: Map<string, JavaScriptIntentsJson> = new Map();
  private extendedIntents: Map<string, any> = new Map();

  constructor(baseIntentsPath: string) {
    const baseContent = fs.readFileSync(baseIntentsPath, 'utf-8');
    this.baseIntents = JSON.parse(baseContent);
  }

  /**
   * Load a language-specific intent file
   */
  loadLanguageExtension(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const extension = JSON.parse(content) as JavaScriptIntentsJson;
    
    // Register for each language this extension supports
    for (const language of extension.languages) {
      this.languageExtensions.set(language, extension);
    }

    // Register extended intents
    if (extension.extended) {
      for (const [intentName, intentDef] of Object.entries(extension.extended)) {
        this.extendedIntents.set(intentName, intentDef);
      }
    }
  }

  /**
   * Validate a single semantic node
   * Returns an array of validation issues (empty if valid)
   */
  validateNode(node: SemanticNode, language: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const extension = this.languageExtensions.get(language);

    // 1. Basic structural validation from base intents
    issues.push(...this.validateNodeStructure(node));

    // 2. Intent validation
    const intentIssue = this.validateIntent(node, extension);
    if (intentIssue) {
      issues.push(intentIssue);
      return issues; // Stop if intent is invalid
    }

    // 3. Target requirement validation
    issues.push(...this.validateTargetRequirement(node, extension));

    // 4. Weight validation
    issues.push(...this.validateWeight(node, extension));

    // 5. Location validation
    issues.push(...this.validateLocation(node.location));

    // 6. Language-specific AST node mapping validation
    if (extension) {
      issues.push(...this.validateAgainstAstMap(node, extension));
    }

    // 7. Metadata schema validation
    if (extension && extension.validation.metadataSchema[node.intent]) {
      issues.push(...this.validateMetadata(node, extension));
    }

    // 8. Language-specific rules from validation section
    if (extension) {
      issues.push(...this.applyLanguageSpecificRules(node, extension));
    }

    // 9. Weight override validation
    if (extension) {
      issues.push(...this.validateWeightOverrides(node, extension));
    }

    return issues;
  }

  /**
   * Validate multiple nodes and generate report
   * Returns a comprehensive validation report with issues and statistics
   */
  validateAll(nodes: SemanticNode[], language: string): ValidationReport {
    const issues: ValidationIssue[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const node of nodes) {
      const nodeIssues = this.validateNode(node, language);
      
      if (nodeIssues.length === 0) {
        validCount++;
      } else {
        invalidCount++;
        issues.push(...nodeIssues);
      }
    }

    const warnings = issues.filter(i => i.type === 'warning').length;
    const errors = issues.filter(i => i.type === 'error').length;

    return {
      isValid: errors === 0,
      issues,
      stats: {
        totalNodes: nodes.length,
        validNodes: validCount,
        invalidNodes: invalidCount,
        warnings
      }
    };
  }

  /**
   * Validate node structure against base requirements
   */
  private validateNodeStructure(node: SemanticNode): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const requiredFields = this.baseIntents.validation.requiredNodeFields;

    for (const field of requiredFields) {
      if (!node[field as keyof SemanticNode]) {
        issues.push({
          type: 'error',
          message: `Missing required field: ${field}`,
          nodeId: node.id,
          rule: 'required-field'
        });
      }
    }

    // Validate ID pattern
    const idPattern = new RegExp(this.baseIntents.validation.idPattern);
    if (node.id && !idPattern.test(node.id)) {
      issues.push({
        type: 'error',
        message: `Node ID must match pattern: ${this.baseIntents.validation.idPattern}`,
        nodeId: node.id,
        rule: 'id-format'
      });
    }

    return issues;
  }

  /**
   * Validate intent against base and extended intents
   */
  private validateIntent(node: SemanticNode, extension?: JavaScriptIntentsJson): ValidationIssue | null {
    const baseValidExamples = this.baseIntents.validation.intentResolution.validExamples;
    
    // Check if intent is in base valid examples
    if (baseValidExamples.includes(node.intent)) {
      return null;
    }

    // Check if intent is in language-specific allowed intents
    if (extension && extension.validation.allowedIntents.includes(node.intent)) {
      return null;
    }

    // Check if intent is an extended intent
    if (this.extendedIntents.has(node.intent)) {
      // Verify extended intent follows contract
      const extendedIntent = this.extendedIntents.get(node.intent);
      if (!(extendedIntent.metadata?.intentSource === 'extended')) {
        return {
          type: 'error',
          message: `Extended intent '${node.intent}' must have metadata.intentSource = 'extended'`,
          nodeId: node.id,
          rule: 'extended-intent-contract'
        };
      }
      return null;
    }

    // Intent not found
    const allValidIntents = [
      ...baseValidExamples,
      ...(extension?.validation.allowedIntents || []),
      ...Array.from(this.extendedIntents.keys())
    ];

    return {
      type: 'error',
      message: `Invalid intent '${node.intent}'. Must be one of: ${allValidIntents.join(', ')}`,
      nodeId: node.id,
      rule: 'intent-resolution'
    };
  }

  /**
   * Validate target requirement based on intent
   */
  private validateTargetRequirement(node: SemanticNode, extension?: JavaScriptIntentsJson): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Check base target requirements
    const baseRequired = this.baseIntents.validation.targetRequirement.required;
    if (baseRequired.includes(node.intent) && !node.target) {
      issues.push({
        type: 'error',
        message: `Intent '${node.intent}' requires a target`,
        nodeId: node.id,
        rule: 'target-required'
      });
    }

    // Check language-specific target requirements
    if (extension) {
      if (extension.validation.targetRequiredFor.includes(node.intent) && !node.target) {
        issues.push({
          type: 'error',
          message: `Intent '${node.intent}' requires a target per ${extension.name}`,
          nodeId: node.id,
          rule: 'target-required-language'
        });
      }
    }

    return issues;
  }

  /**
   * Validate weight is within range
   */
  private validateWeight(node: SemanticNode, extension?: JavaScriptIntentsJson): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const [min, max] = this.baseIntents.validation.weightRange;

    if (node.weight < min || node.weight > max) {
      issues.push({
        type: 'error',
        message: `Weight ${node.weight} must be between ${min} and ${max}`,
        nodeId: node.id,
        rule: 'weight-range'
      });
    }

    return issues;
  }

  /**
   * Validate location fields
   */
  private validateLocation(location: SourceLocation): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!location.start || !location.end) {
      issues.push({
        type: 'error',
        message: 'Location must have start and end',
        rule: 'location-fields'
      });
      return issues;
    }

    if (location.start.line < 0 || location.start.column < 0 || 
        location.end.line < 0 || location.end.column < 0) {
      issues.push({
        type: 'error',
        message: 'Line and column numbers must be non-negative',
        rule: 'location-non-negative'
      });
    }

    if (location.start.line > location.end.line || 
        (location.start.line === location.end.line && location.start.column > location.end.column)) {
      issues.push({
        type: 'error',
        message: 'End position must be after start position',
        rule: 'location-order'
      });
    }

    return issues;
  }

  /**
   * Validate node against AST node mapping
   */
  private validateAgainstAstMap(node: SemanticNode, extension: JavaScriptIntentsJson): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const nodeType = node.metadata?.nodeType;

    if (!nodeType) {
      return issues; // Skip if no node type info
    }

    // Search through all categories in astNodeMap
    for (const [category, categoryData] of Object.entries(extension.astNodeMap)) {
      const nodes = categoryData.nodes;
      if (nodes[nodeType]) {
        const nodeDef = nodes[nodeType];
        
        // Check if intent matches what the AST node should map to
        const expectedIntent = nodeDef.intent || categoryData.intent;
        if (expectedIntent && node.intent !== expectedIntent) {
          issues.push({
            type: 'error',
            message: `AST node ${nodeType} should map to intent '${expectedIntent}', got '${node.intent}'`,
            nodeId: node.id,
            rule: 'ast-node-mapping'
          });
        }

        // Check if target is present when required by node definition
        if (nodeDef.requiresTarget && !node.target) {
          issues.push({
            type: 'error',
            message: `AST node ${nodeType} requires a target`,
            nodeId: node.id,
            rule: 'ast-node-target'
          });
        }

        break;
      }
    }

    return issues;
  }

  /**
   * Validate metadata against schema
   */
  private validateMetadata(node: SemanticNode, extension: JavaScriptIntentsJson): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const schema = extension.validation.metadataSchema[node.intent];

    if (!schema || !node.metadata) {
      return issues;
    }

    // Check for required metadata fields (marked with "REQUIRED" in description)
    for (const [field, description] of Object.entries(schema)) {
      if (description.includes('REQUIRED') && !node.metadata[field]) {
        issues.push({
          type: 'error',
          message: `Required metadata field '${field}' missing for intent '${node.intent}'`,
          nodeId: node.id,
          rule: 'metadata-required'
        });
      }
    }

    // Special check for extended intents
    if (this.extendedIntents.has(node.intent) && node.metadata.intentSource !== 'extended') {
      issues.push({
        type: 'error',
        message: `Extended intent '${node.intent}' must have metadata.intentSource = 'extended'`,
        nodeId: node.id,
        rule: 'extended-metadata'
      });
    }

    return issues;
  }

  /**
   * Apply language-specific validation rules
   */
  private applyLanguageSpecificRules(node: SemanticNode, extension: JavaScriptIntentsJson): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const rules = extension.validation.languageSpecificRules;

    for (const rule of rules) {
      // Parse and apply each rule
      if (rule.includes("Do NOT emit 'call' for require()") && 
          node.metadata?.isCJS && node.intent === 'call') {
        issues.push({
          type: 'error',
          message: "require() calls must emit 'import' with metadata.isCJS = true, not 'call'",
          nodeId: node.id,
          rule: 'require-as-import'
        });
      }

      if ((rule.includes("Do NOT emit 'definition.function' for inline lambdas")) &&
          (node.metadata?.isInline) && (node.intent as string === 'definition.function' )) {
        issues.push({
          type: 'error',
          message: "Inline lambdas should emit 'definition.lambda', not 'definition.function'",
          nodeId: node.id,
          rule: 'inline-lambda'
        });
      }

      if (rule.includes("JSXElement with lowercase tag") &&
          node.metadata?.isIntrinsic && node.weight !== 0.15) {
        issues.push({
          type: 'warning',
          message: "Intrinsic JSX elements should have weight 0.15",
          nodeId: node.id,
          rule: 'jsx-intrinsic-weight',
          suggestion: 'Set weight to 0.15 for intrinsic HTML elements'
        });
      }

      if (rule.includes("ImportDeclaration with importKind = 'type'") &&
          node.metadata?.importKind === 'type' && node.intent === 'import') {
        issues.push({
          type: 'warning',
          message: "Type-only imports should use extended intent 'type_import'",
          nodeId: node.id,
          rule: 'type-import-preference',
          suggestion: "Use intent 'type_import' with metadata.importKind = 'type'"
        });
      }

      if (rule.includes("ExportNamedDeclaration / ExportDefaultDeclaration of a type") &&
          node.metadata?.exportKind === 'type' && node.intent === 'export') {
        issues.push({
          type: 'warning',
          message: "Type exports should use extended intent 'type_export'",
          nodeId: node.id,
          rule: 'type-export-preference',
          suggestion: "Use intent 'type_export' with metadata.exportKind = 'type'"
        });
      }
    }

    return issues;
  }

  /**
   * Validate weight against language-specific overrides
   */
  private validateWeightOverrides(node: SemanticNode, extension: JavaScriptIntentsJson): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const override of extension.weightOverrides.rules) {
      let matches = false;

      // Check each override condition
      if (override.condition === "NewExpression (constructor call)" && 
          node.metadata?.isConstructor) {
        matches = true;
      } else if (override.condition.includes("importKind = 'type'") && 
                 node.metadata?.importKind === 'type') {
        matches = true;
      } else if (override.condition.includes("isIntrinsic = true") && 
                 node.metadata?.isIntrinsic) {
        matches = true;
      } else if (override.condition.includes("isChained = true") && 
                 node.metadata?.isChained) {
        matches = true;
      } else if (override.condition.includes("isBuiltin = true") && 
                 node.metadata?.isBuiltin) {
        matches = true;
      }

      if (matches && node.weight !== override.weight) {
        issues.push({
          type: 'warning',
          message: `Weight ${node.weight} differs from recommended override: ${override.weight}`,
          nodeId: node.id,
          rule: 'weight-override',
          suggestion: `${override.condition} should have weight ${override.weight} (${override.rationale})`
        });
      }
    }

    return issues;
  }

  /**
   * Check if a file extension is supported for a language
   */
  isExtensionSupported(filePath: string, language: string): boolean {
    const extension = this.languageExtensions.get(language);
    if (!extension) return false;

    const ext = path.extname(filePath);
    return extension.extensions.includes(ext);
  }

  /**
   * Get all registered languages
   */
  getRegisteredLanguages(): string[] {
    return Array.from(this.languageExtensions.keys());
  }

  /**
   * Get validation summary
   */
  getValidationSummary(): Record<string, any> {
    return {
      baseIntents: {
        version: this.baseIntents.version,
        name: this.baseIntents.name,
        validIntents: this.baseIntents.validation.intentResolution.validExamples.length
      },
      languageExtensions: Array.from(this.languageExtensions.entries()).map(([lang, ext]) => ({
        language: lang,
        version: ext.version,
        name: ext.name,
        extendedIntents: Object.keys(ext.extended || {}).length,
        astNodeCategories: Object.keys(ext.astNodeMap).length
      })),
      extendedIntents: Array.from(this.extendedIntents.keys())
    };
  }
}

/**
 * Factory to create configured validators
 */
export class ValidatorFactory {
  static createWithDefaultConfig(): SemanticValidator {
    // In a real implementation, you'd resolve these paths properly
    const validator = new SemanticValidator('./base-intents.json');
    
    // Load JavaScript extension
    try {
      validator.loadLanguageExtension('./javascript-intents.json');
    } catch (error) {
      console.warn('Could not load JavaScript intents:', error);
    }
    
    return validator;
  }

  static createWithPaths(basePath: string, languagePaths: string[]): SemanticValidator {
    const validator = new SemanticValidator(basePath);
    
    for (const langPath of languagePaths) {
      try {
        validator.loadLanguageExtension(langPath);
      } catch (error) {
        console.warn(`Could not load language intents from ${langPath}:`, error);
      }
    }
    
    return validator;
  }
}

/**
 * Example usage of the SemanticValidator with test nodes
 * // initialize validator with default config
 * const validator = ValidatorFactory.createWithDefaultConfig();
 *  const nodes: SemanticNode[] = [
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
        importKind: 'value',
        isDefault: true,
        specifiers: ['React']
      }
    },
    {
      id: 'src/components/Button.tsx:15:30:definition.function.Button',
      intent: 'definition.function' as any, // Intent might be overridden by extended intent 'definition.component'
      name: 'Button',
      location: {
        start: { line: 15, column: 0 },
        end: { line: 25, column: 1 }
      },
      weight: 0.7,
      metadata: {
        nodeType: 'FunctionDeclaration',
        isComponent: true,
        hasJSXReturn: true,
        parameters: [{name: 'props', type: 'ButtonProps'}],
        scope: 'module'
      }
    },
    {
      id: 'src/utils/helpers.ts:5:18:type_import.UserType',
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
    }
  ];

  // validate for ts react 
    const report = validator.validateAll(nodes, 'typescriptreact');
 console.log('Validation Report:');
  console.log(JSON.stringify(report, null, 2));
  
  // Get validation summary
  console.log('\nValidator Summary:');
  console.log(validator.getValidationSummary());
 */
