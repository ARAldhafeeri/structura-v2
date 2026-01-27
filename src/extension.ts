import * as vscode from 'vscode';
import { GraphGenerator } from './graphGenerator';
import { GraphPanel } from './graphPanel';

let graphPanel: GraphPanel | undefined;
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
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const config = vscode.workspace.getConfiguration('structura');
        const baseDir = config.get<string>('baseDirectory') || workspaceRoot;
        const ignorePatterns = config.get<string[]>('ignorePatterns') || [];

        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating code graph...',
            cancellable: false,
          },
          async () => {
            const generator = new GraphGenerator(baseDir, ignorePatterns);
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
      }
    }
  );

  context.subscriptions.push(showGraphCommand, refreshCommand);
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}