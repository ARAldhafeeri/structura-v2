# Native-Language Parser Architecture

## Why Parsers Should Be Written in Their Native Languages

We designed only the way at which the parser should be written, what contract we expect out of it, we allow contributors to use their own programming language for the static and dynamic analysis of both AST and runtime, multiple programming languages have utilities that allow for this, we don't want people to reinvent the wheel using e.g. NodeJS to perform AST or dynamic analysis.

### Benefits

1. **Leverage Native Tooling**: Use battle-tested AST parsers from each language's ecosystem
   - Python: `ast` module (built-in)
   - Go: `go/ast` package (official)
   - Rust: `syn` crate (de facto standard)
   - Java: Java Parser library

2. **Better Parser Quality**: Native developers know their language's edge cases better
   - Idioms and patterns specific to that language
   - Language-specific features (Python decorators, Go interfaces, Rust macros)

3. **Easier Contributions**: Contributors can write parsers in languages they're comfortable with
   - Python developers write the Python parser
   - Go developers write the Go parser
   - No need to learn TypeScript/Node.js

4. **Performance**: Native parsers are often more optimized than JavaScript ports
   - Go's parser is blazingly fast
   - Rust's parser is memory-efficient
   - Python's `ast` is well-optimized

5. **Maintainability**: Changes in language specs are handled by native communities
   - TypeScript 5.0 features → TypeScript team maintains parser
   - Python 3.12 syntax → Python core team maintains `ast`

---

## Architecture: Parser as Child Process

### Communication Model

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension                        │
│                      (TypeScript/Node.js)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           ParserExecutor (TypeScript)                 │  │
│  │  - Spawns child processes                            │  │
│  │  - Manages stdin/stdout communication                │  │
│  │  - Handles timeouts and errors                       │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │ JSON via stdin/stdout
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Python     │ │   Go         │ │   Rust       │
│   Parser     │ │   Parser     │ │   Parser     │
│              │ │              │ │              │
│  (Native)    │ │  (Native)    │ │  (Native)    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Contract: Standard Input/Output

All parsers communicate via JSON on stdin/stdout:

**Input (from extension):**
```json
{
  "command": "parse",
  "filePath": "/project/src/main.py",
  "options": {
    "includeComments": false,
    "includeLocations": true
  }
}
```

**Output (from parser):**
```json
{
  "success": true,
  "language": "python",
  "filePath": "/project/src/main.py",
  "semanticNodes": [
    {
      "id": "main.py:1:Import",
      "intent": "import",
      "name": "os",
      "target": "os",
      "location": {
        "start": { "line": 1, "column": 0 },
        "end": { "line": 1, "column": 9 }
      },
      "weight": 0.9
    }
  ],
  "diagnostics": [],
  "metadata": {
    "parseTime": 45,
    "nodeCount": 23
  }
}
```

---

##  Project Structure

```
structura/
├── src/                              # TypeScript extension core
│   ├── extension.ts                  # VS Code entry point
│   ├── parsers/
│   │   ├── executor.ts               # ParserExecutor (spawns child processes)
│   │   ├── registry.ts               # ParserRegistry (manages parsers)
│   │   ├── contract.ts               # TypeScript interfaces for JSON contract
│   │   └── validator.ts              # Validates parser output
│   ├── graph/
│   │   ├── builder.ts
│   │   ├── expander.ts
│   │   └── weights.ts
│   ├── storage/
│   │   └── filesystem.ts
│   └── ui/
│       ├── panel.ts
│       └── visualizer.ts
│
├── parsers/                          # Native language parsers
│   │
│   ├── javascript/                   # JavaScript/TypeScript parser
│   │   ├── package.json              # Node.js dependencies (@babel/parser)
│   │   ├── parser.ts                 # Main parser implementation
│   │   └── bin/
│   │       └── parse                 # Executable entry point
│   │
│   ├── python/                       # Python parser
│   │   ├── requirements.txt          # (none needed, uses stdlib)
│   │   ├── parser.py                 # Main parser implementation
│   │   └── bin/
│   │       └── parse                 # Executable: #!/usr/bin/env python3
│   │
│   ├── go/                           # Go parser
│   │   ├── go.mod                    # Go module definition
│   │   ├── go.sum                    # Dependency lock
│   │   ├── parser.go                 # Main parser implementation
│   │   └── bin/
│   │       └── parse                 # Compiled binary
│   │
│   ├── rust/                         # Rust parser
│   │   ├── Cargo.toml                # Rust package definition
│   │   ├── Cargo.lock                # Dependency lock
│   │   ├── src/
│   │   │   └── main.rs               # Main parser implementation
│   │   └── bin/
│   │       └── parse                 # Compiled binary
│   │
│   └── java/                         # Java parser
│       ├── pom.xml                   # Maven config
│       ├── src/
│       │   └── main/
│       │       └── java/
│       │           └── Parser.java   # Main parser implementation
│       └── bin/
│           └── parse                 # Launch script
│
├── definitions/                      # Language semantic mappings
│   ├── javascript.json
│   ├── python.json
│   ├── go.json
│   ├── rust.json
│   └── java.json
│
├── tests/
│   ├── fixtures/                     # Test files in various languages
│   │   ├── javascript/
│   │   ├── python/
│   │   └── go/
│   └── parsers/                      # Parser integration tests
│       ├── javascript.test.ts
│       ├── python.test.ts
│       └── go.test.ts
│
├── scripts/
│   ├── build-parsers.sh              # Build all parsers
│   ├── test-parsers.sh               # Test all parsers
│   └── package-parsers.sh            # Package parsers for distribution
│
├── package.json                      # Extension manifest
├── tsconfig.json
└── README.md
```

---

## Simple Implementation Details

### 1. ParserExecutor (TypeScript)

```typescript
// src/parsers/executor.ts
import { spawn } from 'child_process';
import { ParserOutput, ParserInput } from './contract';

export class ParserExecutor {
  private timeout = 30000; // 30 seconds

  async execute(
    parserPath: string,
    input: ParserInput
  ): Promise<ParserOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn(parserPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Send input via stdin
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();

      // Collect stdout
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr for debugging
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      child.on('close', (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          reject(new Error(`Parser exited with code ${code}\n${stderr}`));
          return;
        }

        try {
          const output = JSON.parse(stdout) as ParserOutput;
          resolve(output);
        } catch (error) {
          reject(new Error(`Invalid JSON output: ${error.message}`));
        }
      });

      // Handle errors
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      // Timeout protection
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Parser timeout'));
      }, this.timeout);
    });
  }
}
```
