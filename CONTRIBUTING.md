# Contributing to Structura

## Getting Started

```bash
git clone https://github.com/AhmedRakan/structura
cd structura
npm install
```

Open in VS Code and press `F5` to launch the extension in a new Extension Development Host window.

## Architecture

All user actions flow through the priority queue — no direct state mutations outside handlers.

```
User action → vscode.postMessage → GraphPanel.onEnqueue
  → createTask → TaskProcessor.process
    → handler(task, ctx) → ctx.graph / ctx.cache / ctx.webview
      → webview re-renders
```

**Priority levels:**
| Level | Category |
|-------|----------|
| 6000 | graph-construction |
| 5000 | user-interaction |
| 3000 | local-indexing |
| 2000 | snapshotting |
| 1000 | other |

## Adding a New Task

1. Add the subtype string to the appropriate union in `src/contract/PriorityTaskQueue.ts`
2. Add it to `SUBTYPE_TO_CATEGORY` and `SUBTYPE_DEFAULT_PRIORITIES`
3. Export a handler from `src/core/processors/index.ts`
4. Register it in `buildProcessor()` in `src/extension.ts`

## Running Tests

```bash
npm test
```

## Building the Package

```bash
npm run package
```
