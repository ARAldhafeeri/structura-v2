import * as vscode from 'vscode';
import { GraphData } from './graphGenerator';

export class GraphPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private extensionUri: vscode.Uri) {}

  show(graphData: GraphData): void {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'structuraGraph',
        'Code Graph',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      // Handle messages from webview
      this.panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'openFile':
              await this.openFile(message.path, message.line);
              break;
            case 'refresh':
              vscode.commands.executeCommand('structura.refreshGraph');
              break;
          }
        }
      );
    }

    this.panel.webview.html = this.getWebviewContent(graphData);
  }

  private async openFile(relativePath: string, line: number): Promise<void> {
    if (!vscode.workspace.workspaceFolders) return;

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('structura');
    const baseDir = config.get<string>('baseDirectory') || workspaceRoot;
    const fullPath = vscode.Uri.file(`${baseDir}/${relativePath}`);

    try {
      const document = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(document);
      
      // Jump to line
      const position = new vscode.Position(Math.max(0, line - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Could not open file: ${relativePath}`);
    }
  }

  private getWebviewContent(graphData: GraphData): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Graph</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      overflow: hidden;
    }

    #container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    #header {
      background: #252526;
      border-bottom: 1px solid #3e3e42;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #header h1 {
      font-size: 16px;
      font-weight: 600;
      color: #cccccc;
    }

    #stats {
      display: flex;
      gap: 24px;
      font-size: 13px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #4fc3f7;
    }

    .stat-label {
      font-size: 11px;
      color: #858585;
      margin-top: 2px;
    }

    #controls {
      display: flex;
      gap: 8px;
    }

    button {
      background: #3c3c3c;
      border: 1px solid #555555;
      color: #cccccc;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    button:hover {
      background: #4c4c4c;
      border-color: #666666;
    }

    button:active {
      background: #2c2c2c;
    }

    #main {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    #cy {
      width: 100%;
      height: 100%;
      background: #1e1e1e;
    }

    #legend {
      position: absolute;
      top: 16px;
      left: 16px;
      background: rgba(37, 37, 38, 0.95);
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 12px;
      font-size: 12px;
      z-index: 1000;
    }

    .legend-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: #cccccc;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    #info {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(37, 37, 38, 0.95);
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 12px;
      font-size: 12px;
      max-width: 300px;
      z-index: 1000;
      display: none;
    }

    #info.visible {
      display: block;
    }

    .info-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      color: #4fc3f7;
    }

    .info-row {
      margin-bottom: 6px;
      display: flex;
    }

    .info-label {
      color: #858585;
      min-width: 60px;
    }

    .info-value {
      color: #cccccc;
      word-break: break-all;
    }

    .info-button {
      margin-top: 8px;
      width: 100%;
    }

    #instructions {
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: rgba(37, 37, 38, 0.95);
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 11px;
      color: #858585;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="header">
      <h1>📊 Code Structure Graph</h1>
      <div id="stats">
        <div class="stat-item">
          <div class="stat-value" id="nodeCount">0</div>
          <div class="stat-label">Files</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="edgeCount">0</div>
          <div class="stat-label">Imports</div>
        </div>
      </div>
      <div id="controls">
        <button onclick="fitGraph()">Fit All</button>
        <button onclick="refresh()">Refresh</button>
      </div>
    </div>
    <div id="main">
      <div id="legend">
        <div class="legend-title">Node Types</div>
        <div class="legend-item">
          <div class="legend-color" style="background: #4fc3f7;"></div>
          <span>File</span>
        </div>
      </div>
      <div id="info"></div>
      <div id="instructions">
        Click node to view details • Double-click to open file • Drag to pan • Scroll to zoom
      </div>
      <div id="cy"></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const graphData = ${JSON.stringify(graphData)};

    // Update stats
    document.getElementById('nodeCount').textContent = graphData.nodes.length;
    document.getElementById('edgeCount').textContent = graphData.edges.length;

    // Transform data for Cytoscape
    const elements = [
      ...graphData.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          path: node.path,
          line: node.line || 1
        }
      })),
      ...graphData.edges.map((edge, i) => ({
        data: {
          id: 'e' + i,
          source: edge.source,
          target: edge.target,
          type: edge.type
        }
      }))
    ];

    // Initialize Cytoscape
    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#4fc3f7',
            'label': 'data(label)',
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'width': '30px',
            'height': '30px',
            'border-width': '2px',
            'border-color': '#1e1e1e',
            'text-outline-width': '2px',
            'text-outline-color': '#1e1e1e'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#ff9800',
            'border-color': '#ff5722',
            'border-width': '3px'
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'background-color': '#9c27b0',
            'border-color': '#e91e63',
            'border-width': '3px'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#555555',
            'target-arrow-color': '#555555',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#9c27b0',
            'target-arrow-color': '#9c27b0',
            'width': 3
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        edgeElasticity: 100
      }
    });

    let selectedNode = null;

    // Node click handler
    cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const nodeData = node.data();

      // Clear previous highlights
      cy.elements().removeClass('highlighted');

      // Highlight connected nodes and edges
      const connected = node.neighborhood().add(node);
      connected.addClass('highlighted');

      // Show info panel
      selectedNode = nodeData;
      showInfo(nodeData);
    });

    // Double click to open file
    cy.on('dbltap', 'node', function(evt) {
      const node = evt.target;
      const nodeData = node.data();
      openFile(nodeData.path, nodeData.line);
    });

    // Click background to clear
    cy.on('tap', function(evt) {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted');
        hideInfo();
        selectedNode = null;
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'x' || e.key === 'Escape') {
        // Close/clear selection
        cy.elements().removeClass('highlighted');
        hideInfo();
        selectedNode = null;
      } else if (e.key === 'o' && selectedNode) {
        // Open selected file
        openFile(selectedNode.path, selectedNode.line);
      }
    });

    function showInfo(nodeData) {
      const info = document.getElementById('info');
      info.innerHTML = \`
        <div class="info-title">\${nodeData.label}</div>
        <div class="info-row">
          <span class="info-label">Type:</span>
          <span class="info-value">\${nodeData.type}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Path:</span>
          <span class="info-value">\${nodeData.path}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Line:</span>
          <span class="info-value">\${nodeData.line}</span>
        </div>
        <button class="info-button" onclick="openFile('\${nodeData.path}', \${nodeData.line})">
          Open in Editor
        </button>
      \`;
      info.classList.add('visible');
    }

    function hideInfo() {
      const info = document.getElementById('info');
      info.classList.remove('visible');
    }

    function fitGraph() {
      cy.fit(null, 50);
    }

    function openFile(path, line) {
      vscode.postMessage({
        command: 'openFile',
        path: path,
        line: line
      });
    }

    function refresh() {
      vscode.postMessage({
        command: 'refresh'
      });
    }

    // Initial fit
    setTimeout(() => fitGraph(), 100);
  </script>
</body>
</html>`;
  }
}