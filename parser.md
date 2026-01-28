# Native-Language Parser Architecture

## Why Parsers Should Be Written in Their Native Languages

We designed only the way at which the parser should be written, what contract we expect out of it, we allow contributors to use their own programming language for the static and dynamic analysis of both AST and runtime, multiple programming languages have utilities that allow for this, we don't want people to reinvent the wheel using e.g. NodeJS to perform AST or dynamic analysis.

Parsers should be in their own github repository as 'structura-parser-<progranmming-langauge-name>' This allow for maximum sacalbility and code maintaince, only the output binary will be used in structura-core. 

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
│   │       └── parse                 # Executable entry point
│   │
│   ├── python/                       # Python parser
│   │     └── parse                 # Executable: #!/usr/bin/env python3
│   │
│   ├── go/                        # Go parser
│   │    └── parse                 # Compiled binary
│   │
│   ├── rust/                         # Rust parser
│   │    └── parse                 # Compiled binary
│   │
│   └── java/                         # Java parser
│         └── parse                 # Launch script
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

Use following repository link as an example <a target="_blank" href="">stractura-js-ts-parser ( TBA )</a>, please read the section below `Unified Parser Output Contract` throughly before attempting to build the parser, as well feel free to ask me any questions.



# Unified Parser Output Contract

All language parsers in Structura must produce a **standardized JSON output** regardless of the programming language being parsed. This contract ensures the semantic layer can process any language identically.

As well feel free to extend base-intents.json on both your repo and here, make sure you truly turn AST logic blocks into intents, for example, `java and javascript extends keyword` it's pointless to add 'extend' as semantic intent, you should use inheritance which is more langauge agnostic intent <a href="./base-intents.json" target="_blank">base-intents.json</a> add specific intent when they are absoutely needed for example `defer` keyword in golang for goroutines and so on.

Please read the following guide on intents <a href="./intents.md" target="_blank">intents.md</a>

---

## Core Contract: ParserOutput

```typescript
interface ParserOutput {
  success: boolean;              // Was parsing successful?
  language: string;              // "javascript" | "python" | "go" | "rust" | "java"
  filePath: string;              // Absolute path to parsed file
  
  // The unified output - language-agnostic semantic nodes
  semanticNodes: SemanticNode[];
  
  // Diagnostics (errors, warnings)
  diagnostics: Diagnostic[];
  
  // Metadata about the parse operation
  metadata: {
    parseTime: number;           // Milliseconds
    nodeCount: number;           // Total semantic nodes extracted
    astVersion?: string;         // Parser version used
    [key: string]: any;          // Language-specific metadata
  };
}
```

### SemanticNode (The Universal Format)

```typescript
interface SemanticNode {
  // Unique identifier: "filepath:line:column:type"
  id: string;
  
  // Semantic intent (universal across all languages)
  intent: "import" | "export" | "definition" | "call";
  
  // The identifier name
  name: string;
  
  // What this node references (for imports/calls)
  target?: string;
  
  // Source location
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  
  // Importance weight (from language definition)
  weight: number;
  
  // Additional context (language-specific but optional)
  metadata?: {
    nodeType: string;            // Original AST node type
    scope?: string;              // "module" | "class" | "function"
    visibility?: string;         // "public" | "private" | "protected"
    isAsync?: boolean;
    isStatic?: boolean;
    parameters?: Parameter[];
    returnType?: string;
    decorators?: string[];
    [key: string]: any;
  };
}

interface Parameter {
  name: string;
  type?: string;
  defaultValue?: string;
}
```

### Diagnostic

```typescript
interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  code?: string;                 // Error code if applicable
}
```

---

## Language-Specific Examples

### Example 1: JavaScript/TypeScript

**Input File:** `src/api/client.ts`

```typescript
import axios from 'axios';
import { Config } from './config';

export class ApiClient {
  private baseUrl: string;
  
  constructor(config: Config) {
    this.baseUrl = config.apiUrl;
  }
  
  async fetchData(endpoint: string): Promise<any> {
    return await axios.get(`${this.baseUrl}/${endpoint}`);
  }
}

export const createClient = (config: Config) => new ApiClient(config);
```

**Parser Output:**

```json
{
  "success": true,
  "language": "javascript",
  "filePath": "/project/src/api/client.ts",
  "semanticNodes": [
    {
      "id": "/project/src/api/client.ts:1:0:ImportDeclaration",
      "intent": "import",
      "name": "axios",
      "target": "axios",
      "location": {
        "start": { "line": 1, "column": 0 },
        "end": { "line": 1, "column": 23 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportDeclaration",
        "importKind": "value",
        "isDefault": true
      }
    },
    {
      "id": "/project/src/api/client.ts:2:0:ImportDeclaration",
      "intent": "import",
      "name": "Config",
      "target": "./config",
      "location": {
        "start": { "line": 2, "column": 0 },
        "end": { "line": 2, "column": 32 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportDeclaration",
        "importKind": "value",
        "isDefault": false,
        "isNamed": true
      }
    },
    {
      "id": "/project/src/api/client.ts:4:0:ClassDeclaration",
      "intent": "definition",
      "name": "ApiClient",
      "location": {
        "start": { "line": 4, "column": 0 },
        "end": { "line": 13, "column": 1 }
      },
      "weight": 0.8,
      "metadata": {
        "nodeType": "ClassDeclaration",
        "scope": "module",
        "visibility": "public",
        "isExported": true
      }
    },
    {
      "id": "/project/src/api/client.ts:7:2:MethodDefinition",
      "intent": "definition",
      "name": "constructor",
      "location": {
        "start": { "line": 7, "column": 2 },
        "end": { "line": 9, "column": 3 }
      },
      "weight": 0.6,
      "metadata": {
        "nodeType": "MethodDefinition",
        "scope": "class",
        "visibility": "public",
        "parameters": [
          { "name": "config", "type": "Config" }
        ]
      }
    },
    {
      "id": "/project/src/api/client.ts:11:2:MethodDefinition",
      "intent": "definition",
      "name": "fetchData",
      "location": {
        "start": { "line": 11, "column": 2 },
        "end": { "line": 13, "column": 3 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "MethodDefinition",
        "scope": "class",
        "visibility": "public",
        "isAsync": true,
        "parameters": [
          { "name": "endpoint", "type": "string" }
        ],
        "returnType": "Promise<any>"
      }
    },
    {
      "id": "/project/src/api/client.ts:12:11:CallExpression",
      "intent": "call",
      "name": "get",
      "target": "axios.get",
      "location": {
        "start": { "line": 12, "column": 11 },
        "end": { "line": 12, "column": 55 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpression",
        "scope": "function",
        "callee": "axios.get"
      }
    },
    {
      "id": "/project/src/api/client.ts:16:0:ExportNamedDeclaration",
      "intent": "export",
      "name": "createClient",
      "location": {
        "start": { "line": 16, "column": 0 },
        "end": { "line": 16, "column": 72 }
      },
      "weight": 0.8,
      "metadata": {
        "nodeType": "ExportNamedDeclaration",
        "exportKind": "value"
      }
    },
    {
      "id": "/project/src/api/client.ts:16:13:FunctionDeclaration",
      "intent": "definition",
      "name": "createClient",
      "location": {
        "start": { "line": 16, "column": 13 },
        "end": { "line": 16, "column": 72 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "ArrowFunctionExpression",
        "scope": "module",
        "parameters": [
          { "name": "config", "type": "Config" }
        ]
      }
    },
    {
      "id": "/project/src/api/client.ts:16:47:CallExpression",
      "intent": "call",
      "name": "ApiClient",
      "target": "ApiClient",
      "location": {
        "start": { "line": 16, "column": 47 },
        "end": { "line": 16, "column": 67 }
      },
      "weight": 0.4,
      "metadata": {
        "nodeType": "NewExpression",
        "scope": "function"
      }
    }
  ],
  "diagnostics": [],
  "metadata": {
    "parseTime": 45,
    "nodeCount": 9,
    "astVersion": "@babel/parser@7.23.0"
  }
}
```

---

### Example 2: Python

**Input File:** `app/database.py`

```python
import os
from typing import Optional, List
from sqlalchemy import create_engine
from .models import User, Session

class Database:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
        self.session = Session()
    
    async def get_user(self, user_id: int) -> Optional[User]:
        """Fetch user by ID"""
        return self.session.query(User).filter_by(id=user_id).first()
    
    def create_user(self, username: str, email: str) -> User:
        user = User(username=username, email=email)
        self.session.add(user)
        self.session.commit()
        return user

def setup_database():
    db_url = os.getenv('DATABASE_URL')
    return Database(db_url)
```

**Parser Output:**

```json
{
  "success": true,
  "language": "python",
  "filePath": "/project/app/database.py",
  "semanticNodes": [
    {
      "id": "/project/app/database.py:1:0:Import",
      "intent": "import",
      "name": "os",
      "target": "os",
      "location": {
        "start": { "line": 1, "column": 0 },
        "end": { "line": 1, "column": 9 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "Import",
        "module": "os"
      }
    },
    {
      "id": "/project/app/database.py:2:0:ImportFrom",
      "intent": "import",
      "name": "Optional",
      "target": "typing",
      "location": {
        "start": { "line": 2, "column": 0 },
        "end": { "line": 2, "column": 35 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportFrom",
        "module": "typing",
        "names": ["Optional", "List"]
      }
    },
    {
      "id": "/project/app/database.py:3:0:ImportFrom",
      "intent": "import",
      "name": "create_engine",
      "target": "sqlalchemy",
      "location": {
        "start": { "line": 3, "column": 0 },
        "end": { "line": 3, "column": 38 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportFrom",
        "module": "sqlalchemy"
      }
    },
    {
      "id": "/project/app/database.py:4:0:ImportFrom",
      "intent": "import",
      "name": "User",
      "target": ".models",
      "location": {
        "start": { "line": 4, "column": 0 },
        "end": { "line": 4, "column": 37 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportFrom",
        "module": ".models",
        "isRelative": true,
        "names": ["User", "Session"]
      }
    },
    {
      "id": "/project/app/database.py:6:0:ClassDef",
      "intent": "definition",
      "name": "Database",
      "location": {
        "start": { "line": 6, "column": 0 },
        "end": { "line": 19, "column": 19 }
      },
      "weight": 0.8,
      "metadata": {
        "nodeType": "ClassDef",
        "scope": "module",
        "bases": [],
        "decorators": []
      }
    },
    {
      "id": "/project/app/database.py:7:4:FunctionDef",
      "intent": "definition",
      "name": "__init__",
      "location": {
        "start": { "line": 7, "column": 4 },
        "end": { "line": 9, "column": 37 }
      },
      "weight": 0.6,
      "metadata": {
        "nodeType": "FunctionDef",
        "scope": "class",
        "parameters": [
          { "name": "self" },
          { "name": "connection_string", "type": "str" }
        ]
      }
    },
    {
      "id": "/project/app/database.py:8:21:Call",
      "intent": "call",
      "name": "create_engine",
      "target": "create_engine",
      "location": {
        "start": { "line": 8, "column": 21 },
        "end": { "line": 8, "column": 54 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "Call",
        "scope": "function"
      }
    },
    {
      "id": "/project/app/database.py:11:4:AsyncFunctionDef",
      "intent": "definition",
      "name": "get_user",
      "location": {
        "start": { "line": 11, "column": 4 },
        "end": { "line": 13, "column": 73 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "AsyncFunctionDef",
        "scope": "class",
        "isAsync": true,
        "parameters": [
          { "name": "self" },
          { "name": "user_id", "type": "int" }
        ],
        "returnType": "Optional[User]",
        "docstring": "Fetch user by ID"
      }
    },
    {
      "id": "/project/app/database.py:13:15:Call",
      "intent": "call",
      "name": "query",
      "target": "self.session.query",
      "location": {
        "start": { "line": 13, "column": 15 },
        "end": { "line": 13, "column": 67 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "Call",
        "scope": "function",
        "chained": true
      }
    },
    {
      "id": "/project/app/database.py:15:4:FunctionDef",
      "intent": "definition",
      "name": "create_user",
      "location": {
        "start": { "line": 15, "column": 4 },
        "end": { "line": 19, "column": 19 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FunctionDef",
        "scope": "class",
        "parameters": [
          { "name": "self" },
          { "name": "username", "type": "str" },
          { "name": "email", "type": "str" }
        ],
        "returnType": "User"
      }
    },
    {
      "id": "/project/app/database.py:16:15:Call",
      "intent": "call",
      "name": "User",
      "target": "User",
      "location": {
        "start": { "line": 16, "column": 15 },
        "end": { "line": 16, "column": 52 }
      },
      "weight": 0.4,
      "metadata": {
        "nodeType": "Call",
        "scope": "function"
      }
    },
    {
      "id": "/project/app/database.py:21:0:FunctionDef",
      "intent": "definition",
      "name": "setup_database",
      "location": {
        "start": { "line": 21, "column": 0 },
        "end": { "line": 23, "column": 24 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FunctionDef",
        "scope": "module",
        "parameters": []
      }
    },
    {
      "id": "/project/app/database.py:22:13:Call",
      "intent": "call",
      "name": "getenv",
      "target": "os.getenv",
      "location": {
        "start": { "line": 22, "column": 13 },
        "end": { "line": 22, "column": 38 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "Call",
        "scope": "function"
      }
    },
    {
      "id": "/project/app/database.py:23:11:Call",
      "intent": "call",
      "name": "Database",
      "target": "Database",
      "location": {
        "start": { "line": 23, "column": 11 },
        "end": { "line": 23, "column": 24 }
      },
      "weight": 0.4,
      "metadata": {
        "nodeType": "Call",
        "scope": "function"
      }
    }
  ],
  "diagnostics": [],
  "metadata": {
    "parseTime": 32,
    "nodeCount": 15,
    "astVersion": "Python 3.11.0"
  }
}
```

---

### Example 3: Go

**Input File:** `pkg/api/handler.go`

```go
package api

import (
    "encoding/json"
    "net/http"
    "github.com/myapp/pkg/models"
    "github.com/myapp/pkg/database"
)

type Handler struct {
    db *database.Database
}

func NewHandler(db *database.Database) *Handler {
    return &Handler{db: db}
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Query().Get("id")
    user, err := h.db.GetUser(id)
    
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    json.NewEncoder(w).Encode(user)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var user models.User
    json.NewDecoder(r.Body).Decode(&user)
    
    err := h.db.CreateUser(&user)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(user)
}
```

**Parser Output:**

```json
{
  "success": true,
  "language": "go",
  "filePath": "/project/pkg/api/handler.go",
  "semanticNodes": [
    {
      "id": "/project/pkg/api/handler.go:3:0:ImportSpec",
      "intent": "import",
      "name": "json",
      "target": "encoding/json",
      "location": {
        "start": { "line": 4, "column": 4 },
        "end": { "line": 4, "column": 21 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportSpec",
        "path": "encoding/json"
      }
    },
    {
      "id": "/project/pkg/api/handler.go:5:0:ImportSpec",
      "intent": "import",
      "name": "http",
      "target": "net/http",
      "location": {
        "start": { "line": 5, "column": 4 },
        "end": { "line": 5, "column": 14 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportSpec",
        "path": "net/http"
      }
    },
    {
      "id": "/project/pkg/api/handler.go:6:0:ImportSpec",
      "intent": "import",
      "name": "models",
      "target": "github.com/myapp/pkg/models",
      "location": {
        "start": { "line": 6, "column": 4 },
        "end": { "line": 6, "column": 39 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportSpec",
        "path": "github.com/myapp/pkg/models",
        "isLocal": true
      }
    },
    {
      "id": "/project/pkg/api/handler.go:7:0:ImportSpec",
      "intent": "import",
      "name": "database",
      "target": "github.com/myapp/pkg/database",
      "location": {
        "start": { "line": 7, "column": 4 },
        "end": { "line": 7, "column": 42 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportSpec",
        "path": "github.com/myapp/pkg/database",
        "isLocal": true
      }
    },
    {
      "id": "/project/pkg/api/handler.go:10:0:TypeSpec",
      "intent": "definition",
      "name": "Handler",
      "location": {
        "start": { "line": 10, "column": 0 },
        "end": { "line": 12, "column": 1 }
      },
      "weight": 0.8,
      "metadata": {
        "nodeType": "TypeSpec",
        "kind": "struct",
        "scope": "package",
        "isExported": true
      }
    },
    {
      "id": "/project/pkg/api/handler.go:14:0:FuncDecl",
      "intent": "definition",
      "name": "NewHandler",
      "location": {
        "start": { "line": 14, "column": 0 },
        "end": { "line": 16, "column": 1 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FuncDecl",
        "scope": "package",
        "isExported": true,
        "parameters": [
          { "name": "db", "type": "*database.Database" }
        ],
        "returnType": "*Handler"
      }
    },
    {
      "id": "/project/pkg/api/handler.go:18:0:FuncDecl",
      "intent": "definition",
      "name": "GetUser",
      "location": {
        "start": { "line": 18, "column": 0 },
        "end": { "line": 27, "column": 1 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FuncDecl",
        "scope": "package",
        "isExported": true,
        "receiver": {
          "name": "h",
          "type": "*Handler"
        },
        "parameters": [
          { "name": "w", "type": "http.ResponseWriter" },
          { "name": "r", "type": "*http.Request" }
        ]
      }
    },
    {
      "id": "/project/pkg/api/handler.go:20:17:CallExpr",
      "intent": "call",
      "name": "GetUser",
      "target": "h.db.GetUser",
      "location": {
        "start": { "line": 20, "column": 17 },
        "end": { "line": 20, "column": 32 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "receiver": "h.db"
      }
    },
    {
      "id": "/project/pkg/api/handler.go:23:8:CallExpr",
      "intent": "call",
      "name": "Error",
      "target": "http.Error",
      "location": {
        "start": { "line": 23, "column": 8 },
        "end": { "line": 23, "column": 62 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "package": "http"
      }
    },
    {
      "id": "/project/pkg/api/handler.go:27:4:CallExpr",
      "intent": "call",
      "name": "Encode",
      "target": "json.NewEncoder.Encode",
      "location": {
        "start": { "line": 27, "column": 4 },
        "end": { "line": 27, "column": 32 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "chained": true
      }
    },
    {
      "id": "/project/pkg/api/handler.go:30:0:FuncDecl",
      "intent": "definition",
      "name": "CreateUser",
      "location": {
        "start": { "line": 30, "column": 0 },
        "end": { "line": 41, "column": 1 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FuncDecl",
        "scope": "package",
        "isExported": true,
        "receiver": {
          "name": "h",
          "type": "*Handler"
        },
        "parameters": [
          { "name": "w", "type": "http.ResponseWriter" },
          { "name": "r", "type": "*http.Request" }
        ]
      }
    },
    {
      "id": "/project/pkg/api/handler.go:32:4:CallExpr",
      "intent": "call",
      "name": "Decode",
      "target": "json.NewDecoder.Decode",
      "location": {
        "start": { "line": 32, "column": 4 },
        "end": { "line": 32, "column": 43 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "chained": true
      }
    },
    {
      "id": "/project/pkg/api/handler.go:34:12:CallExpr",
      "intent": "call",
      "name": "CreateUser",
      "target": "h.db.CreateUser",
      "location": {
        "start": { "line": 34, "column": 12 },
        "end": { "line": 34, "column": 32 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "receiver": "h.db"
      }
    }
  ],
  "diagnostics": [],
  "metadata": {
    "parseTime": 28,
    "nodeCount": 13,
    "astVersion": "go1.21"
  }
}
```

---

### Example 4: Rust

**Input File:** `src/server.rs`

```rust
use std::sync::Arc;
use tokio::net::TcpListener;
use crate::database::Database;
use crate::models::User;

pub struct Server {
    db: Arc<Database>,
    port: u16,
}

impl Server {
    pub fn new(db: Database, port: u16) -> Self {
        Server {
            db: Arc::new(db),
            port,
        }
    }
    
    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(format!("0.0.0.0:{}", self.port)).await?;
        
        loop {
            let (socket, _) = listener.accept().await?;
            let db = self.db.clone();
            
            tokio::spawn(async move {
                handle_connection(socket, db).await;
            });
        }
    }
}

async fn handle_connection(socket: TcpStream, db: Arc<Database>) {
    let user = db.get_user(1).await.unwrap();
    // Handle connection...
}

pub fn create_server(port: u16) -> Server {
    let db = Database::new();
    Server::new(db, port)
}
```

**Parser Output:**

```json
{
  "success": true,
  "language": "rust",
  "filePath": "/project/src/server.rs",
  "semanticNodes": [
    {
      "id": "/project/src/server.rs:1:0:UseDeclaration",
      "intent": "import",
      "name": "Arc",
      "target": "std::sync::Arc",
      "location": {
        "start": { "line": 1, "column": 0 },
        "end": { "line": 1, "column": 23 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "UseDeclaration",
        "path": "std::sync::Arc",
        "isStd": true
      }
    },
    {
      "id": "/project/src/server.rs:2:0:UseDeclaration",
      "intent": "import",
      "name": "TcpListener",
      "target": "tokio::net::TcpListener",
      "location": {
        "start": { "line": 2, "column": 0 },
        "end": { "line": 2, "column": 32 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "UseDeclaration",
        "path": "tokio::net::TcpListener",
        "isExternal": true
      }
    },
    {
      "id": "/project/src/server.rs:3:0:UseDeclaration",
      "intent": "import",
      "name": "Database",
      "target": "crate::database::Database",
      "location": {
        "start": { "line": 3, "column": 0 },
        "end": { "line": 3, "column": 32 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "UseDeclaration",
        "path": "crate::database::Database",
        "isLocal": true
      }
    },
    {
      "id": "/project/src/server.rs:4:0:UseDeclaration",
      "intent": "import",
      "name": "User",
      "target": "crate::models::User",
      "location": {
        "start": { "line": 4, "column": 0 },
        "end": { "line": 4, "column": 26 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "UseDeclaration",
        "path": "crate::models::User",
        "isLocal": true
      }
    },
    {
      "id": "/project/src/server.rs:6:0:StructItem",
      "intent": "definition",
      "name": "Server",
      "location": {
        "start": { "line": 6, "column": 0 },
        "end": { "line": 9, "column": 1 }
      },
      "weight": 0.8,
      "metadata": {
        "nodeType": "StructItem",
        "scope": "module",
        "visibility": "public"
      }
    },
    {
      "id": "/project/src/server.rs:12:4:FunctionItem",
      "intent": "definition",
      "name": "new",
      "location": {
        "start": { "line": 12, "column": 4 },
        "end": { "line": 17, "column": 5 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FunctionItem",
        "scope": "impl",
        "visibility": "public",
        "parameters": [
          { "name": "db", "type": "Database" },
          { "name": "port", "type": "u16" }
        ],
        "returnType": "Self"
      }
    },
    {
      "id": "/project/src/server.rs:14:16:CallExpr",
      "intent": "call",
      "name": "new",
      "target": "Arc::new",
      "location": {
        "start": { "line": 14, "column": 16 },
        "end": { "line": 14, "column": 28 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "path": "Arc::new"
      }
    },
    {
      "id": "/project/src/server.rs:19:4:FunctionItem",
      "intent": "definition",
      "name": "run",
      "location": {
        "start": { "line": 19, "column": 4 },
        "end": { "line": 29, "column": 5 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FunctionItem",
        "scope": "impl",
        "visibility": "public",
        "isAsync": true,
        "parameters": [
          { "name": "self", "type": "&self" }
        ],
        "returnType": "Result<(), Box<dyn std::error::Error>>"
      }
    },
    {
      "id": "/project/src/server.rs:20:23:CallExpr",
      "intent": "call",
      "name": "bind",
      "target": "TcpListener::bind",
      "location": {
        "start": { "line": 20, "column": 23 },
        "end": { "line": 20, "column": 78 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "isAwait": true
      }
    },
    {
      "id": "/project/src/server.rs:26:12:CallExpr",
      "intent": "call",
      "name": "spawn",
      "target": "tokio::spawn",
      "location": {
        "start": { "line": 26, "column": 12 },
        "end": { "line": 28, "column": 13 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "path": "tokio::spawn"
      }
    },
    {
      "id": "/project/src/server.rs:27:16:CallExpr",
      "intent": "call",
      "name": "handle_connection",
      "target": "handle_connection",
      "location": {
        "start": { "line": 27, "column": 16 },
        "end": { "line": 27, "column": 46 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "isAwait": true
      }
    },
    {
      "id": "/project/src/server.rs:32:0:FunctionItem",
      "intent": "definition",
      "name": "handle_connection",
      "location": {
        "start": { "line": 32, "column": 0 },
        "end": { "line": 35, "column": 1 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FunctionItem",
        "scope": "module",
        "visibility": "private",
        "isAsync": true,
        "parameters": [
          { "name": "socket", "type": "TcpStream" },
          { "name": "db", "type": "Arc<Database>" }
        ]
      }
    },
    {
      "id": "/project/src/server.rs:33:15:CallExpr",
      "intent": "call",
      "name": "get_user",
      "target": "db.get_user",
      "location": {
        "start": { "line": 33, "column": 15 },
        "end": { "line": 33, "column": 44 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "isAwait": true
      }
    },
    {
      "id": "/project/src/server.rs:37:0:FunctionItem",
      "intent": "definition",
      "name": "create_server",
      "location": {
        "start": { "line": 37, "column": 0 },
        "end": { "line": 40, "column": 1 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "FunctionItem",
        "scope": "module",
        "visibility": "public",
        "parameters": [
          { "name": "port", "type": "u16" }
        ],
        "returnType": "Server"
      }
    },
    {
      "id": "/project/src/server.rs:38:13:CallExpr",
      "intent": "call",
      "name": "new",
      "target": "Database::new",
      "location": {
        "start": { "line": 38, "column": 13 },
        "end": { "line": 38, "column": 28 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "path": "Database::new"
      }
    },
    {
      "id": "/project/src/server.rs:39:4:CallExpr",
      "intent": "call",
      "name": "new",
      "target": "Server::new",
      "location": {
        "start": { "line": 39, "column": 4 },
        "end": { "line": 39, "column": 24 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "CallExpr",
        "scope": "function",
        "path": "Server::new"
      }
    }
  ],
  "diagnostics": [],
  "metadata": {
    "parseTime": 38,
    "nodeCount": 16,
    "astVersion": "syn 2.0.0"
  }
}
```

---

### Example 5: Java

**Input File:** `com/myapp/api/UserController.java`

```java
package com.myapp.api;

import java.util.List;
import com.myapp.models.User;
import com.myapp.services.UserService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    
    public UserController(UserService userService) {
        this.userService = userService;
    }
    
    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
    
    @PostMapping
    public User createUser(@RequestBody User user) {
        return userService.save(user);
    }
    
    @GetMapping
    public List<User> getAllUsers() {
        return userService.findAll();
    }
}
```

**Parser Output:**

```json
{
  "success": true,
  "language": "java",
  "filePath": "/project/com/myapp/api/UserController.java",
  "semanticNodes": [
    {
      "id": "/project/com/myapp/api/UserController.java:3:0:ImportDeclaration",
      "intent": "import",
      "name": "List",
      "target": "java.util.List",
      "location": {
        "start": { "line": 3, "column": 0 },
        "end": { "line": 3, "column": 22 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportDeclaration",
        "package": "java.util",
        "isStatic": false
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:4:0:ImportDeclaration",
      "intent": "import",
      "name": "User",
      "target": "com.myapp.models.User",
      "location": {
        "start": { "line": 4, "column": 0 },
        "end": { "line": 4, "column": 30 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportDeclaration",
        "package": "com.myapp.models",
        "isLocal": true,
        "isStatic": false
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:5:0:ImportDeclaration",
      "intent": "import",
      "name": "UserService",
      "target": "com.myapp.services.UserService",
      "location": {
        "start": { "line": 5, "column": 0 },
        "end": { "line": 5, "column": 40 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportDeclaration",
        "package": "com.myapp.services",
        "isLocal": true,
        "isStatic": false
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:6:0:ImportDeclaration",
      "intent": "import",
      "name": "*",
      "target": "org.springframework.web.bind.annotation",
      "location": {
        "start": { "line": 6, "column": 0 },
        "end": { "line": 6, "column": 50 }
      },
      "weight": 0.9,
      "metadata": {
        "nodeType": "ImportDeclaration",
        "package": "org.springframework.web.bind.annotation",
        "isWildcard": true,
        "isStatic": false
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:10:0:ClassDeclaration",
      "intent": "definition",
      "name": "UserController",
      "location": {
        "start": { "line": 10, "column": 0 },
        "end": { "line": 30, "column": 1 }
      },
      "weight": 0.8,
      "metadata": {
        "nodeType": "ClassDeclaration",
        "scope": "package",
        "visibility": "public",
        "decorators": [
          "@RestController",
          "@RequestMapping(\"/api/users\")"
        ]
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:13:4:ConstructorDeclaration",
      "intent": "definition",
      "name": "UserController",
      "location": {
        "start": { "line": 13, "column": 4 },
        "end": { "line": 15, "column": 5 }
      },
      "weight": 0.6,
      "metadata": {
        "nodeType": "ConstructorDeclaration",
        "scope": "class",
        "visibility": "public",
        "parameters": [
          { "name": "userService", "type": "UserService" }
        ]
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:18:4:MethodDeclaration",
      "intent": "definition",
      "name": "getUser",
      "location": {
        "start": { "line": 18, "column": 4 },
        "end": { "line": 20, "column": 5 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "MethodDeclaration",
        "scope": "class",
        "visibility": "public",
        "parameters": [
          { "name": "id", "type": "Long" }
        ],
        "returnType": "User",
        "decorators": [
          "@GetMapping(\"/{id}\")"
        ]
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:19:15:MethodCallExpr",
      "intent": "call",
      "name": "findById",
      "target": "userService.findById",
      "location": {
        "start": { "line": 19, "column": 15 },
        "end": { "line": 19, "column": 40 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "MethodCallExpr",
        "scope": "method",
        "receiver": "userService"
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:23:4:MethodDeclaration",
      "intent": "definition",
      "name": "createUser",
      "location": {
        "start": { "line": 23, "column": 4 },
        "end": { "line": 25, "column": 5 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "MethodDeclaration",
        "scope": "class",
        "visibility": "public",
        "parameters": [
          { "name": "user", "type": "User" }
        ],
        "returnType": "User",
        "decorators": [
          "@PostMapping"
        ]
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:24:15:MethodCallExpr",
      "intent": "call",
      "name": "save",
      "target": "userService.save",
      "location": {
        "start": { "line": 24, "column": 15 },
        "end": { "line": 24, "column": 37 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "MethodCallExpr",
        "scope": "method",
        "receiver": "userService"
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:28:4:MethodDeclaration",
      "intent": "definition",
      "name": "getAllUsers",
      "location": {
        "start": { "line": 28, "column": 4 },
        "end": { "line": 30, "column": 5 }
      },
      "weight": 0.7,
      "metadata": {
        "nodeType": "MethodDeclaration",
        "scope": "class",
        "visibility": "public",
        "parameters": [],
        "returnType": "List<User>",
        "decorators": [
          "@GetMapping"
        ]
      }
    },
    {
      "id": "/project/com/myapp/api/UserController.java:29:15:MethodCallExpr",
      "intent": "call",
      "name": "findAll",
      "target": "userService.findAll",
      "location": {
        "start": { "line": 29, "column": 15 },
        "end": { "line": 29, "column": 37 }
      },
      "weight": 0.3,
      "metadata": {
        "nodeType": "MethodCallExpr",
        "scope": "method",
        "receiver": "userService"
      }
    }
  ],
  "diagnostics": [],
  "metadata": {
    "parseTime": 41,
    "nodeCount": 12,
    "astVersion": "javaparser-core 3.25.0"
  }
}
```

---

## Error Handling

### Example: Parse Error

```json
{
  "success": false,
  "language": "javascript",
  "filePath": "/project/src/broken.js",
  "semanticNodes": [],
  "diagnostics": [
    {
      "severity": "error",
      "message": "Unexpected token (2:15)",
      "location": {
        "start": { "line": 2, "column": 15 },
        "end": { "line": 2, "column": 16 }
      },
      "code": "BABEL_PARSE_ERROR"
    }
  ],
  "metadata": {
    "parseTime": 12,
    "nodeCount": 0,
    "astVersion": "@babel/parser@7.23.0"
  }
}
```

### Example: Parser Not Available

```json
{
  "success": false,
  "language": "python",
  "filePath": "/project/app/main.py",
  "semanticNodes": [],
  "diagnostics": [
    {
      "severity": "error",
      "message": "Python parser not available. Install Python 3.8+ to parse Python files.",
      "code": "PARSER_UNAVAILABLE"
    }
  ],
  "metadata": {
    "parseTime": 5,
    "nodeCount": 0
  }
}
```

---

## Key Principles for Parser Implementers

### 1. **Semantic Intent Mapping**
Every language-specific AST node MUST be mapped to one of the four semantic intents:
- `import` - Any form of importing external code
- `export` - Any form of exposing code to external consumers
- `definition` - Any declaration of a reusable code unit (function, class, type)
- `call` - Any invocation of code

### 2. **Stable Node IDs**
Node IDs MUST be deterministic and unique:
```
{filePath}:{line}:{column}:{nodeType}
```

### 3. **Weight Assignment**
Use weights from the language definition file. If not specified, use these defaults:
- `import`: 0.9
- `export`: 0.8
- `definition`: 0.7
- `call`: 0.3

### 4. **Target Resolution**
For `import` and `call` nodes, populate the `target` field:
- **Imports**: The module/package path being imported
- **Calls**: The function/method being called

### 5. **Location Accuracy**
Line and column numbers MUST be accurate for code navigation features to work.

### 6. **Metadata Enrichment**
While optional, including rich metadata helps with advanced features:
- Parameter types
- Return types
- Decorators/annotations
- Visibility modifiers
- Async/await markers

### 7. **Error Tolerance**
Parsers should be resilient:
- Parse what you can, skip what you can't
- Report errors in `diagnostics`, don't crash
- Return partial results when possible

---

## Validation Checklist

Before submitting a parser, verify it produces valid output:

- [ ] Output is valid JSON
- [ ] `success` is boolean
- [ ] `language` matches language definition name
- [ ] `filePath` is an absolute path
- [ ] Every `semanticNode` has required fields: `id`, `intent`, `name`, `location`, `weight`
- [ ] All `intent` values are one of: `import`, `export`, `definition`, `call`
- [ ] Node IDs are unique within the file
- [ ] Location coordinates are positive integers
- [ ] Weights are between 0.0 and 1.0
- [ ] `target` is present for `import` and `call` nodes
- [ ] `diagnostics` array is present (can be empty)
- [ ] `metadata.parseTime` and `metadata.nodeCount` are present

---

## Testing Your Parser

### Test Input: `test/fixtures/basic.{ext}`

Create a simple test file in your target language with:
- At least 1 import
- At least 1 export
- At least 1 function/class definition
- At least 1 function call

### Expected Output

Run your parser and verify:
1. All four semantic intent types are present
2. Node count matches expected nodes
3. Locations point to correct lines
4. No errors in diagnostics

### Example Test Command

```bash
# JavaScript parser
./parsers/javascript/parse /absolute/path/to/test/fixtures/basic.js | jq .

# Python parser
./parsers/python/parse /absolute/path/to/test/fixtures/basic.py | jq .

# Verify structure
./parsers/YOUR_LANG/parse FILE_PATH | jq '.semanticNodes[0]'
```

