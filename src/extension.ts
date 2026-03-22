import * as vscode from 'vscode';
import { createTask } from './contract/PriorityTaskQueue.js';
import { GraphGenerator } from './graphGenerator.js';
import { GraphPanel } from './graphPanel.js';
import { baseDir, config, ignorePatterns } from './config.js';
import { TaskProcessor, TaskProcessorRegistry } from './core/TaskProcessor.js';
import {
  onInitializeGraph, onBuildInitialGraph, onParseFile, onExpandNode, onCollapseNode,
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
  reg('graph-construction',   'collapse-node',          onCollapseNode);
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

  const processor = buildProcessor();

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(graph) Structura';
  statusBarItem.tooltip = 'Show Code Graph';
  statusBarItem.command = 'structura.showGraph';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register show graph command
  const showGraphCommand = vscode.commands.registerCommand(
    'structura.showGraph',
    async () => {
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      try {       

        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating code graph...',
            cancellable: false,
          },
          async () => {
            const generator = new GraphGenerator(baseDir as string, ignorePatterns);
            const graphData = await generator.generate();

            if (!graphPanel) {
              graphPanel = new GraphPanel(context.extensionUri, (task) => {
                processor.process(task);
              });
            }
            graphPanel.show(graphData);
          
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate graph: ${error}`
        );
      }
    }
  );

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
  'structura.refreshGraph',
  async () => {
    if (graphPanel) {
      vscode.commands.executeCommand('structura.showGraph');
    } else {
      vscode.window.showInformationMessage('No graph open to refresh.');
    }
  }
);

  context.subscriptions.push(showGraphCommand, refreshCommand);
}

export function deactivate() {

}