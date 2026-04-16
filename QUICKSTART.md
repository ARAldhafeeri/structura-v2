# Structura — Quick Start

Get from install to exploring your codebase in under two minutes.

---

## 1. Install

**From VS Code Marketplace** *(when published)*

Open Extensions (`Ctrl+Shift+X`), search **Structura**, click Install.

---

**From source (development build)**

```bash
git clone https://github.com/ARAldhafeeri/structura-v2.git
cd structura-v2
npm install
npm run package          # produces structura-mvp-0.1.0.vsix
code --install-extension structura-mvp-0.1.0.vsix
```

Restart VS Code after installing the `.vsix`.

---

**Run without installing (for contributors)**

```bash
# Open the repo in VS Code, after installing the extension 
# you should see stractura in the status bar if not
# ctrl + shift + p 
# search for developer : reload window
```

---

## 2. Open a JavaScript / TypeScript project

Structura analyses your workspace folder. Open any JS or TS project:

```
File → Open Folder  (or  code /path/to/your-project)
```

> Structura currently supports `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`.

---

## 3. Launch the graph

Three ways — pick whichever feels natural:

| Method | How |
|--------|-----|
| **Keyboard** | `Ctrl+Alt+G` &nbsp;(Mac: `Cmd+Alt+G`) |
| **Status bar** | Click **$(graph) Structura** in the bottom-right corner |
| **Command Palette** | `Ctrl+Shift+P` → `Structura: Show Code Graph` |

A progress notification appears while the graph generates, then the panel opens beside your editor.

---

## 4. What you're looking at

```
  ┌──────────────────────────────────────────────────┐
  │  Code Structure Graph        Files: 42  Imports: 87  │
  │                              [ Fit All ] [ Refresh ]  │
  ├──────────────────────────────────────────────────┤
  │                                                      │
  │   ● src/index.ts ──────────► ● src/core/Cache.ts    │
  │        │                                             │
  │        └──────────────────► ● src/graphPanel.ts     │
  │                                                      │
  └──────────────────────────────────────────────────┘
```

- **Each node** = one source file in your project
- **Each arrow** = an `import` / `require` relationship
- **Node count & import count** shown in the header

---

## 5. Explore with the mouse

| Action | Result |
|--------|--------|
| **Click** a node | Highlights the node and all its direct connections |
| **Double-click** a node | Opens that file in the editor |
| **Click** empty space | Clears the current selection |
| **Drag** | Pans the graph |
| **Scroll** | Zooms in / out |
| **Fit All** button | Resets zoom to show all nodes |
| **Refresh** button | Re-scans the workspace after code changes |

---

## 6. Explore with the keyboard

Once the graph panel is focused, use single-key Vim-style shortcuts — no modifiers needed.

### Navigate between nodes

| Key | Direction |
|-----|-----------|
| `h` | ← left |
| `j` | ↓ down |
| `k` | ↑ up |
| `l` | → right |

Structura picks the nearest node in screen-space in that direction. If nothing is selected, pressing any direction key selects the first node.

### Act on the selected node

| Key | Action |
|-----|--------|
| `o` | Open the file in your editor |
| `e` | Expand node (load its dependencies) |
| `c` | Collapse node |
| `p` | Pin node in place |
| `d` | Hide node from view |

### Graph controls

| Key | Action |
|-----|--------|
| `r` | Refresh graph |
| `f` | Fit all nodes to screen |
| `[` | Undo |
| `]` | Redo |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Esc` or `q` | Clear selection |

---

## 7. Typical first-session workflow

```
1.  Press  Ctrl+Alt+G          →  graph appears
2.  Click the entry-point file  →  see everything it imports, highlighted
3.  Double-click any dependency →  jump straight to that file
4.  Back in the graph: press k  →  move focus up to the next file
5.  Press o                     →  open that file without touching the mouse
6.  Press f                     →  zoom out to see the full picture again
```

That loop — click, inspect, navigate, open — is the core Structura experience.

---

## 8. Narrow the analysis (optional)

If your project is large, tell Structura where to focus:

**Settings → search "Structura"**

| Setting | What it does | Example |
|---------|-------------|---------|
| `structura.baseDirectory` | Analyse only this subdirectory | `./src` |
| `structura.ignorePatterns` | Skip matching paths | `["node_modules","dist","**/*.test.ts"]` |

Or via `settings.json`:

```json
{
  "structura.baseDirectory": "./src",
  "structura.ignorePatterns": ["node_modules", "dist", "**/*.spec.ts"]
}
```

After changing settings, press `r` in the graph (or the **Refresh** button) to regenerate.

---

## 9. What's next

| Want to… | Where to look |
|----------|---------------|
| Understand the architecture | [README — Architecture](./README.md#architecture) |
| Customise keyboard shortcuts | VS Code → Preferences → Keyboard Shortcuts → search "structura" |
| Report a bug or request a feature | [GitHub Issues](https://github.com/ARAldhafeeri/structura-v2/issues) |
| Contribute a parser for another language | [README — Contributing](./README.md#contributing) |
