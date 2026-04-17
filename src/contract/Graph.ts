import { WEIGHTS } from "../graph/weights.js";

export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceLocation {
  start: SourcePosition;
  end: SourcePosition;
}

export type NodeIntent = "import" | "export" | "definition" | "call" | "reference" | "type";

export type Scope = "module" | "function" | "class" | "block" | "global";

export type Visibility = "public" | "private" | "protected";

export type ExportKind = "value" | "type" | "both";

export type ImportKind = "value" | "type";

export type WeightType = keyof typeof WEIGHTS;

export interface Parameter {
  name: string;
  type?: string;
  defaultValue?: string;
  optional?: boolean;
  rest?: boolean;
}

export interface SemanticNodeMetadata {
  /** AST node type (e.g., "FunctionDeclaration", "CallExpression") */
  nodeType: string;
  
  /** Scope where this node is defined */
  scope?: Scope;
  
  /** Visibility (for class members) */
  visibility?: Visibility;
  
  /** Whether this is a type export (for TypeScript) */
  exportKind?: ExportKind;
  
  /** Whether this is a type import (for TypeScript) */
  importKind?: ImportKind;
  
  /** For import specifiers - whether it's a default import */
  isDefault?: boolean;
  
  /** For import specifiers - whether it's a named import */
  isNamed?: boolean;

  
  /** For side-effect imports (import 'module') */
  isSideEffect?: boolean;
  
  /** Local name for export specifiers */
  localName?: string;
  
  /** For function declarations */
  isAsync?: boolean;
  
  /** Whether the definition is exported */
  isExported?: boolean;
  
  /** For class declarations */
  superClass?: string;
  
  /** For class decorators */
  decorators?: string[];
  
  /** For class members */
  isStatic?: boolean;
  
  /** Function parameters */
  parameters?: Parameter[];
  
  /** Return type annotation */
  returnType?: string;
  
  /** For interface declarations - extended interfaces */
  extends?: string[];
  
  /** For call expressions - resolved callee name */
  callee?: string;
  
  /** Whether the call is chained (e.g., foo().bar()) */
  chained?: boolean;
  
  /** For enum declarations - whether it's a const enum */
  isConst?: boolean;
  
  /** For type references - type parameters */
  typeParameters?: string;
  
  /** Whether the parameter is optional */
  optional?: boolean;
  
  /** Additional properties for specific node types */
  [key: string]: any;
}

export interface SemanticNode {
  /** Unique identifier for the node (filePath:line:column:nodeType) */
  id: string;
  
  /** Primary intent/purpose of the node */
  intent: NodeIntent;
  
  /** Name of the entity (variable, function, class, etc.) */
  name: string;
  
  /** For imports/exports - the module target */
  target?: string;

  
  /** Source code location */
  location: SourceLocation;
  
  /** Importance weight for graph analysis */
  weight: number;
  
  /** Additional metadata specific to the node type */
  metadata: SemanticNodeMetadata;
  
  /** Optional children nodes (for hierarchical relationships) */
  children?: SemanticNode[];
  
  /** Optional parent node ID (for tree traversal) */
  parentId?: string;
}

export interface SemanticEdge {
  from: string;
  to: string;
  weight: number;
}


export interface NodeFilter {
  /** Filter by intent type */
  intents?: NodeIntent[];
  
  /** Filter by node type */
  nodeTypes?: string[];
  
  /** Filter by scope */
  scopes?: Scope[];
  
  /** Filter by minimum weight */
  minWeight?: number;
  
  /** Filter by maximum weight */
  maxWeight?: number;
  
  /** Include only exported nodes */
  onlyExported?: boolean;
  
  /** Include only imported nodes */
  onlyImported?: boolean;
  
  /** Custom predicate */
  predicate?: (node: SemanticNode) => boolean;
}

export interface GraphQuery {
  /** Find nodes by name (supports regex) */
  name?: string | RegExp;
  
  /** Find nodes by target module */
  target?: string | RegExp;
  
  /** Find nodes by location */
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  
  /** Filter criteria */
  filter?: NodeFilter;
  
  /** Traversal options */
  traverse?: {
    /** Maximum depth for traversal */
    maxDepth?: number;
    /** Include incoming edges */
    inbound?: boolean;
    /** Include outgoing edges */
    outbound?: boolean;
    /** Include nodes at depth */
    includeNodes?: boolean;
  };
}

export interface GraphStats {
  /** Total number of nodes */
  totalNodes: number;
  
  /** Total number of edges */
  totalEdges: number;
  
  /** Count by intent */
  byIntent: Record<NodeIntent, number>;
  
  /** Count by node type */
  byNodeType: Record<string, number>;
  
  /** Count by scope */
  byScope: Record<Scope, number>;
  
  /** Average node weight */
  averageWeight: number;
  
  /** Most connected nodes (by degree) */
  hubs: Array<{ id: string; degree: number }>;
}

/**
 * Simple way to define incremental graph expansions policies 
 */
export type ExpansionPolicy = { order: NodeIntent[]; maxDepth: number; maxNodesPerLevel: number; fanOutLimit: number; weightThreshold: number; stopOnCycles: boolean; includeExternal: boolean };
