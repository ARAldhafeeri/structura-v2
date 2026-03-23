// ============================================================================
// Processor barrel — re-exports every handler grouped by its core counterpart.
// ============================================================================

// core/Directory.ts → depth-controlled incremental directory expansion
export {
  onExpandDirectory,
  onListDirectory,
} from "./Directory.js";

// core/GraphState.ts → graph mutation + webview delivery
export {
  onInitializeGraph,
  onExpandNode,
  onCollapseNode,
  onSendGraphToWebview,
  onHighlightNodes,
  onUpdateLayout,
} from "./GraphState.js";

// core/TSParser.ts → file parsing and initial graph construction
export {
  onBuildInitialGraph,
  onParseFile,
  onBatchProcessFiles,
} from "./TSParser.js";

// core/FileWatcher.ts → file-system event responses
export {
  onFileChange,
  onPrefetchFiles,
} from "./FileWatcher.js";

// core/Cache.ts → LRU cache management
export {
  onUpdateCache,
  onClearExpiredCache,
  onInvalidateCache,
} from "./Cache.js";

// core/Semantic.ts → semantic / vector index
export {
  onBuildSemanticIndex,
  onUpdateNodeIndex,
  onRemoveNodeFromIndex,
  onSemanticSearch,
  onSearchSuggestions,
  onClearSemanticIndex,
} from "./Semantic.js";

// core/Snapshot.ts → snapshot, undo/redo, save/load state
export {
  onSaveState,
  onLoadState,
  onCreateSnapshot,
  onRestoreSnapshot,
  onUndo,
  onRedo,
} from "./Snapshot.js";

// core/Session.ts → user interaction handlers
export {
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onActiveFileChanged,
  onToggleGraph,
  onOpenFileFromNode,
  onExpandSelectedNode,
  onDeselectAllNodes,
  onViewportChange,
  onNodeDragDrop,
  onSelectNode,
  onPinNode,
  onHideNode,
} from "./Session.js";

// core/Validator.ts → settings
export {
  onUpdateSettings,
  onLoadSettings,
} from "./Validator.js";

// core/Walker.ts → background GC and analytics
export {
  onGarbageCollection,
  onCollectAnalytics,
  onSessionLogging,
} from "./Walker.js";
