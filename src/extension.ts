import * as path from 'path';
import * as vscode from 'vscode';
import { createTask } from './contract/PriorityTaskQueue.js';
import { GraphPanel } from './graphPanel.js';
import { config, ignorePatterns } from './config.js';
import { TaskProcessor, TaskProcessorRegistry } from './core/TaskProcessor.js';
import { buildContext } from './core/buildContext.js';
import { WebviewPanelController } from './core/WebviewController.js';
import {
  onInitializeGraph, onBuildInitialGraph, onParseFile, onExpandNode, onExpandNodeImporters, onBuildFullGraph, onCollapseNode, onExpandCategory,
  onFileChange, onBatchProcessFiles, onNodeClick, onNodeDoubleClick, onNodeHover,
  onActiveFileChanged, onToggleGraph, onOpenFileFromNode, onExpandSelectedNode,
  onDeselectAllNodes, onViewportChange, onNodeDragDrop, onSelectNode, onPinNode, onHideNode,
  onSaveState, onLoadState, onCreateSnapshot, onRestoreSnapshot, onUndo, onRedo,
  onUpdateCache, onClearExpiredCache, onInvalidateCache, onBuildSemanticIndex,
  onUpdateNodeIndex, onRemoveNodeFromIndex, onSemanticSearch, onSearchSuggestions,
  onClearSemanticIndex, onGarbageCollection, onCollectAnalytics, onSessionLogging,
  onPrefetchFiles, onSendGraphToWebview, onHighlightNodes, onUpdateLayout,
  onUpdateSettings, onLoadSettings,
} from './core/processors/index.js';

/**
 * Graph panel where the code graph will be displayed.
 * The window of three main sections :
 * 1. Top bar section where the title, stats and info buttons will be displayed.
 * 2. Side panel of extra info about the current node.
 * 3. Main graph section where the graph will be displayed.
 */
let graphPanel: GraphPanel | undefined;
/**
 * Status bar item for the extension.
 */
let statusBarItem: vscode.StatusBarItem;

function buildProcessor(): TaskProcessor {
  const registry = new TaskProcessorRegistry(new Map());
  const pairs: [Parameters<typeof registry.add>[0], Parameters<typeof registry.add>[1]][] = [];

  // Helper to register without needing a full PriorityTask object for the key.
  function reg(type: string, subType: string, handler: Parameters<typeof registry.add>[1]) {
    const fakeTask = { id: '', type, subType, data: null, priority: 0, subPriority: 0, createdAt: 0 };
    registry.add(fakeTask, handler);
  }

  reg('graph-construction',   'initialize-graph',       onInitializeGraph);
  reg('graph-construction',   'build-initial-graph',    onBuildInitialGraph);
  reg('graph-construction',   'parse-file',             onParseFile);
  reg('graph-construction',   'expand-node',            onExpandNode);
  reg('graph-construction',   'expand-node-importers',  onExpandNodeImporters);
  reg('graph-construction',   'build-full-graph',       onBuildFullGraph);
  reg('graph-construction',   'collapse-node',          onCollapseNode);
  reg('graph-construction',   'expand-category',        onExpandCategory);
  reg('graph-construction',   'file-change',            onFileChange);
  reg('graph-construction',   'batch-process-files',    onBatchProcessFiles);
  reg('user-interaction',     'node-click',             onNodeClick);
  reg('user-interaction',     'node-double-click',      onNodeDoubleClick);
  reg('user-interaction',     'node-hover',             onNodeHover);
  reg('user-interaction',     'active-file-changed',    onActiveFileChanged);
  reg('user-interaction',     'toggle-graph',           onToggleGraph);
  reg('user-interaction',     'open-file-from-node',    onOpenFileFromNode);
  reg('user-interaction',     'expand-selected-node',   onExpandSelectedNode);
  reg('user-interaction',     'deselect-all-nodes',     onDeselectAllNodes);
  reg('user-interaction',     'viewport-change',        onViewportChange);
  reg('user-interaction',     'node-drag-drop',         onNodeDragDrop);
  reg('user-interaction',     'select-node',            onSelectNode);
  reg('user-interaction',     'pin-node',               onPinNode);
  reg('user-interaction',     'hide-node',              onHideNode);
  reg('snapshotting',         'save-state',             onSaveState);
  reg('snapshotting',         'load-state',             onLoadState);
  reg('snapshotting',         'create-snapshot',        onCreateSnapshot);
  reg('snapshotting',         'restore-snapshot',       onRestoreSnapshot);
  reg('snapshotting',         'undo',                   onUndo);
  reg('snapshotting',         'redo',                   onRedo);
  reg('snapshotting',         'update-cache',           onUpdateCache);
  reg('snapshotting',         'clear-expired-cache',    onClearExpiredCache);
  reg('snapshotting',         'invalidate-cache',       onInvalidateCache);
  reg('local-indexing',       'build-semantic-index',   onBuildSemanticIndex);
  reg('local-indexing',       'update-node-index',      onUpdateNodeIndex);
  reg('local-indexing',       'remove-node-from-index', onRemoveNodeFromIndex);
  reg('local-indexing',       'semantic-search',        onSemanticSearch);
  reg('local-indexing',       'search-suggestions',     onSearchSuggestions);
  reg('local-indexing',       'clear-semantic-index',   onClearSemanticIndex);
  reg('background-processing','garbage-collection',     onGarbageCollection);
  reg('background-processing','collect-analytics',      onCollectAnalytics);
  reg('background-processing','session-logging',        onSessionLogging);
  reg('background-processing','prefetch-files',         onPrefetchFiles);
  reg('other',                'send-graph-to-webview',  onSendGraphToWebview);
  reg('other',                'highlight-nodes',        onHighlightNodes);
  reg('other',                'update-layout',          onUpdateLayout);
  reg('other',                'update-settings',        onUpdateSettings);
  reg('other',                'load-settings',          onLoadSettings);

  return new TaskProcessor(registry);
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Structura extension activated');

  // Build the shared context first (no webview yet — set lazily on first panel open).
  const ctx = buildContext(context);

  const processor = buildProcessor();
  // Inject ctx so every handler can read/mutate the live graph and cache.
  processor.ctx = ctx;

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(graph) Structura';
  statusBarItem.tooltip = 'Graph active file (Ctrl+Alt+G)';
  statusBarItem.command = 'structura.showGraph';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register show graph command
  const showGraphCommand = vscode.commands.registerCommand(
    'structura.showGraph',
    async () => {
      // Always graph the active tab — that's the entry point for the developer.
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage('Structura: No active tab open. Open a file first.');
        return;
      }

      const activeFilePath = activeEditor.document.uri.fsPath;
      const rootDir = path.dirname(activeFilePath);
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? rootDir;

      try {
        // If the panel is already open, add the focused file's node to the
        // existing graph instead of destroying and rebuilding.
        if (graphPanel && ctx.webview) {
          await processor.process(createTask('parse-file', { filePath: activeFilePath }));
          const programId = `${activeFilePath.replace(/:/g, '%3A')}:1:0:Program`;
          const programNode = ctx.graph.getNode(programId);
          if (programNode) {
            const edges = ctx.graph.getEdges(programId);
            ctx.webview.postMessage({ command: 'nodesAdded', nodes: [programNode], edges });
          }
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Graphing ${path.basename(activeFilePath)}...`,
            cancellable: false,
          },
          async () => {
            // Clear stale graph data before rebuilding.
            ctx.graph.clear();

            await processor.process(createTask('build-initial-graph', {
              rootDir,
              depth: 1, 
              ignorePatterns,
            }));

            graphPanel = new GraphPanel(
              context.extensionUri,
              (task) => { processor.process(task); },
              () => {
                // Called when the user closes the panel.
                graphPanel = undefined;
                ctx.webview = undefined;
              },
            );
            // Wire the webview into ctx so processor handlers can post messages.
            ctx.webview = new WebviewPanelController(graphPanel);

            graphPanel.show(ctx.graph.state, workspaceRoot, activeFilePath);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Structura: Failed to generate graph: ${error}`);
      }
    }
  );

  // Register refresh command — re-runs showGraph so the active tab is always the source.
  const refreshCommand = vscode.commands.registerCommand(
    'structura.refreshGraph',
    () => vscode.commands.executeCommand('structura.showGraph'),
  );

  context.subscriptions.push(showGraphCommand, refreshCommand);
}

export function deactivate() {

}