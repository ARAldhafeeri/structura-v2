/**
 * Validation issue structured for reporting any errors that arise
 * during semantic layer processing for any programming lanaguge.
 * This is used to ensure unified semantic intents in structura
 * across different languages.
 */
export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  rule?: string;
  suggestion?: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalNodes: number;
    validNodes: number;
    invalidNodes: number;
    warnings: number;
  };
}

/**
 * The Base intent json which is used by the semantic validator to validate the intents
 * output of other langauge ast parsers. 
 */

export interface BaseIntentsJson {
  version: string;
  name: string;
  description: string;
  intents: Record<string, any>;
  validation: {
    requiredNodeFields: string[];
    optionalNodeFields: string[];
    idPattern: string;
    intentResolution: {
      validExamples: string[];
    };
    targetRequirement: {
      required: string[];
    };
    weightRange: [number, number];
    locationFields: {
      required: string[];
      positionFields: string[];
      constraints: string;
    };
    extensionContract: {
      rules: string[];
    };
  };
}

export interface JavaScriptIntentsJson {
  version: string;
  name: string;
  extends: string;
  description: string;
  languages: string[];
  extensions: string[];
  astNodeMap: Record<string, any>;
  extended: Record<string, any>;
  weightOverrides: {
    rules: Array<{
      condition: string;
      weight: number;
      rationale: string;
    }>;
  };
  validation: {
    extends: string;
    allowedIntents: string[];
    targetRequiredFor: string[];
    targetOptionalFor: string[];
    metadataSchema: Record<string, Record<string, string>>;
    nodeIdPattern: string;
    languageSpecificRules: string[];
  };
}
