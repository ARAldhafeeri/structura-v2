import * as vscode from 'vscode';
import { GraphGenerator } from './graphGenerator.js';
import { GraphPanel } from './graphPanel.js';
import { baseDir, config, ignorePatterns,  } from './config.js';

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

export function activate(context: vscode.ExtensionContext) {
  console.log('Structura extension activated');

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
              graphPanel = new GraphPanel(context.extensionUri);
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