import type { Queue, Worker } from "bullmq";
import { WEIGHTS } from "./graph/weights.js";

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

export interface SemanticGraph {
  /** All nodes in the graph */
  nodes: Map<string, SemanticNode>;
  
  /** Adjacency list of edges (sourceId -> targetId) */
  edges: Map<string, Set<string>>;
  
  /** Reverse edges for bidirectional traversal */
  reverseEdges: Map<string, Set<string>>;
  
  /** File path this graph represents */
  filePath: string;
  
  /** Source code checksum for cache invalidation */
  sourceHash?: string;
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

// Type guards and utilities
export const isDefinition = (node: SemanticNode): boolean => 
  node.intent === "definition";

export const isImport = (node: SemanticNode): boolean => 
  node.intent === "import";

export const isExport = (node: SemanticNode): boolean => 
  node.intent === "export";

export const isCall = (node: SemanticNode): boolean => 
  node.intent === "call";

export const isTypeNode = (node: SemanticNode): boolean => 
  node.metadata.exportKind === "type" || 
  node.metadata.importKind === "type" ||
  node.metadata.nodeType.startsWith("TS");

export const isFunction = (node: SemanticNode): boolean => 
  node.metadata.nodeType.includes("Function") || 
  node.metadata.nodeType.includes("Method");

export const isClass = (node: SemanticNode): boolean => 
  node.metadata.nodeType === "ClassDeclaration";

export const isVariable = (node: SemanticNode): boolean => 
  node.metadata.nodeType === "VariableDeclarator" ||
  node.metadata.nodeType.includes("Variable");

// Type for the walk visitor
export type NodeVisitor = {
  [K in string]?: (node: any) => void;
} & {
  // Allow any node type with type safety
  [key: string]: ((node: any) => void) | undefined;
};

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

/**
 * Piority Task Queue for managing asynchronous tasks within stractura engine.
 * The queue allows for prioritization of tasks based on their importance.
 * Since the graph construction is incremental and we are aiming to maximize 
 * the developer experience visually, we want to ensure
 * that anything related to the graph construction gets higher priority than other tasks.
 * priority levels:
 * 60 - Graph construction and updates (highest priority)
 * 50 - User interactions (e.g., clicks, hovers)
 * 40 - Background processing (e.g., analytics, logging) (lowest priority)
 * 30 - Maintaining local index of the source code for semantic search 
 * 20- Snapshotting the graph for time-travel debugging
 * 10- Any other tasks that are not critical to the immediate user experience
 * This is not final  and we can adjust as the engine evolves. 
 * Below is the contract 
 */
export interface PriorityTask {
  id: string;
  task: () => Promise<void>;
  type: string;
  priority: number;
  description?: string;
  createdAt: number;
}

export interface WorkerStatus  {
    isProcessing: boolean;
    currentTask?: PriorityTask;
    queueLength: number;
  };
/**
 * Contract for the Priority Task Queue. 
 * This defines the methods that any implementation of the queue must have, 
 * such as adding tasks, processing tasks, clearing the queue, and retrieving pending 
 * tasks and worker status.
 * The PMQ will be built on top of bullmq.
 */
export interface IPriorityTaskQueue {
  addTask: (task: PriorityTask) => void;
  clearQueue: () => void;
  getWorker : () => Worker;
  getQueue : () => Queue;

}

type TASK_NAME = "graph-construction" | "user-interaction" | "background-processing" | "local-indexing" | "snapshotting" | "other";
type PRIORITY_LEVEL = 10 | 20 | 30 | 40 | 50 | 60;
type TaskPriorityMapping = Record<TASK_NAME, PRIORITY_LEVEL>;

export const TASK_NAMES = {
  graphConstruction: "graph-construction",
  userInteraction: "user-interaction",
  backgroundProcessing: "background-processing",
  localIndexing: "local-indexing",
  snapshoting: "snapshoting",
  other: "other",
}
export const TASK_NAMES_WITH_PRIORITY : TaskPriorityMapping = {
  "graph-construction": 60,
  "user-interaction": 50,
  "background-processing": 40,
  "local-indexing": 30,
  "snapshotting": 20,
  "other": 10
}


const getGraphConstructionTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  task,
  type: TASK_NAMES.graphConstruction,
  priority: TASK_NAMES_WITH_PRIORITY["graph-construction"],
  description,
  createdAt: Date.now()
});

const getUserInteractionTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  task,
  type: TASK_NAMES.userInteraction,
  priority: TASK_NAMES_WITH_PRIORITY["user-interaction"],
  description,
  createdAt: Date.now()
});

const getBackgroundProcessingTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  task,
  type: TASK_NAMES.backgroundProcessing,
  priority: TASK_NAMES_WITH_PRIORITY["background-processing"],
  description,
  createdAt: Date.now()
});

const getLocalIndexingTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  type: TASK_NAMES.localIndexing,
  task,
  priority: TASK_NAMES_WITH_PRIORITY["local-indexing"],
  description,
  createdAt: Date.now(),
});

const getSnapshottingTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  type: TASK_NAMES.snapshoting,
  task,
  priority: TASK_NAMES_WITH_PRIORITY["snapshotting"],
  description,
  createdAt: Date.now(),
});

const getOtherTask = (description: string, task: () => Promise<void>): PriorityTask => ({
  id: `task-${Date.now()}`,
  type: TASK_NAMES.other,
  task,
  priority: TASK_NAMES_WITH_PRIORITY["other"],
  description, 
  createdAt: Date.now()
});

// all tasks getter 
export const StracturaQueueTasks = {
  getGraphConstructionTask,
  getUserInteractionTask,
  getBackgroundProcessingTask,
  getLocalIndexingTask,
  getSnapshottingTask,
  getOtherTask
}