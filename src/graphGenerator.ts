import * as fs from 'fs';
import * as path from 'path';
import { parse as babelParse } from '@babel/parser';
import { parse as tsParse } from '@typescript-eslint/parser';

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'module';
  path: string;
  line?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'imports';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class GraphGenerator {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private processedFiles: Set<string> = new Set();

  constructor(
    private baseDir: string,
    private ignorePatterns: string[]
  ) {}

  async generate(): Promise<GraphData> {
    this.nodes.clear();
    this.edges.clear();
    this.processedFiles.clear();

    await this.walkDirectory(this.baseDir);

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }

  private async walkDirectory(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Check ignore patterns
      if (this.shouldIgnore(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath);
      } else if (entry.isFile() && this.isSourceFile(entry.name)) {
        await this.processFile(fullPath);
      }
    }
  }

  private shouldIgnore(name: string): boolean {
    return this.ignorePatterns.some((pattern) =>
      name.includes(pattern)
    );
  }

  private isSourceFile(filename: string): boolean {
    const ext = path.extname(filename);
    return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
  }

  private async processFile(filePath: string): Promise<void> {
    if (this.processedFiles.has(filePath)) {
      return;
    }
    this.processedFiles.add(filePath);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const relativePath = path.relative(this.baseDir, filePath);
      const nodeId = this.getNodeId(filePath);

      // Add file node
      this.nodes.set(nodeId, {
        id: nodeId,
        label: path.basename(filePath),
        type: 'file',
        path: relativePath,
        line: 1,
      });

      // Parse imports
      const imports = this.extractImports(content, filePath);

      // Add edges
      for (const importPath of imports) {
        const resolvedPath = this.resolveImport(filePath, importPath);
        if (resolvedPath && this.isSourceFile(resolvedPath)) {
          const targetId = this.getNodeId(resolvedPath);
          
          // Add target node if not exists
          if (!this.nodes.has(targetId)) {
            const targetRelPath = path.relative(this.baseDir, resolvedPath);
            this.nodes.set(targetId, {
              id: targetId,
              label: path.basename(resolvedPath),
              type: 'file',
              path: targetRelPath,
              line: 1,
            });
          }

          // Add edge
          this.edges.push({
            source: nodeId,
            target: targetId,
            type: 'imports',
          });
        }
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  private extractImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

    try {
      let ast;
      if (isTypeScript) {
        ast = tsParse(content, {
          sourceType: 'module',
          ecmaVersion: 'latest',
          ecmaFeatures: { jsx: true },
        });
      } else {
        ast = babelParse(content, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
        });
      }

      const traverse = (node: any) => {
        if (!node || typeof node !== 'object') return;

        // ES6 imports: import ... from '...'
        if (node.type === 'ImportDeclaration' && node.source?.value) {
          imports.push(node.source.value);
        }

        // CommonJS: require('...')
        if (
          node.type === 'CallExpression' &&
          node.callee?.name === 'require' &&
          node.arguments?.[0]?.type === 'Literal'
        ) {
          imports.push(node.arguments[0].value);
        }

        // Dynamic import: import('...')
        if (node.type === 'ImportExpression' && node.source?.value) {
          imports.push(node.source.value);
        }

        // Traverse children
        for (const key in node) {
          if (Array.isArray(node[key])) {
            node[key].forEach(traverse);
          } else if (typeof node[key] === 'object') {
            traverse(node[key]);
          }
        }
      };

      traverse(ast);
    } catch (error) {
      // If parsing fails, try simple regex fallback
      const importRegex = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)|from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    }

    return imports;
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    // Skip node_modules and external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.resolve(fromDir, importPath);

    // Try different extensions if no extension provided
    if (!path.extname(resolvedPath)) {
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
        const withExt = resolvedPath + ext;
        if (fs.existsSync(withExt)) {
          return withExt;
        }
      }

      // Try index files
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const indexPath = path.join(resolvedPath, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    } else if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }

    return null;
  }

  private getNodeId(filePath: string): string {
    return path.relative(this.baseDir, filePath).replace(/\\/g, '/');
  }
}