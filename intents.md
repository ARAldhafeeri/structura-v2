# Structura Semantic Intents System

The Structura semantic intent system provides a **minimal, language-agnostic base** that all parsers must implement. This allows uniform graph building regardless of programming language while remaining flexible and extensible.

---

## Base Intents (Required)

All parsers MUST map their language's AST nodes to these four core intents:

```json
{
  "intents": {
    "import": "import",
    "export": "export",
    "definition": "definition",
    "call": "call"
  }
}
```

### Intent Descriptions

| Intent | Description | Requires Target | Examples |
|--------|-------------|-----------------|----------|
| `import` | Bringing external code into scope | ✅ Yes | `import X`, `require()`, `use`, `#include` |
| `export` | Exposing code for external use | ❌ No | `export`, `public`, `pub`, `__all__` |
| `definition` | Declaring reusable code units | ❌ No | functions, classes, types, interfaces, variables |
| `call` | Invoking functions/methods | ✅ Yes | `func()`, `obj.method()`, `new Class()` |

---

## How to Use in Your Parser

### 1. Load Base Intents

```javascript
// JavaScript/TypeScript example
import baseIntents from './base-intents.json';

const INTENTS = baseIntents.intents;
// INTENTS = { import: "import", export: "export", ... }
```

```python
# Python example
import json

with open('base-intents.json') as f:
    base_intents = json.load(f)
    
INTENTS = base_intents['intents']
# INTENTS = {'import': 'import', 'export': 'export', ...}
```

```go
// Go example
import (
    "encoding/json"
    "os"
)

type Intents struct {
    Version string            `json:"version"`
    Intents map[string]string `json:"intents"`
}

func LoadBaseIntents() map[string]string {
    file, _ := os.Open("base-intents.json")
    defer file.Close()
    
    var intents Intents
    json.NewDecoder(file).Decode(&intents)
    
    return intents.Intents
}
```

### 2. Map AST Nodes to Intents

```javascript
// JavaScript parser example
function mapNodeToIntent(node) {
    switch (node.type) {
        case 'ImportDeclaration':
        case 'ImportExpression':
            return INTENTS.import;  // returns "import"
            
        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration':
            return INTENTS.export;  // returns "export"
            
        case 'FunctionDeclaration':
        case 'ClassDeclaration':
        case 'VariableDeclaration':
            return INTENTS.definition;  // returns "definition"
            
        case 'CallExpression':
        case 'NewExpression':
            return INTENTS.call;  // returns "call"
            
        default:
            return null;  // Not a semantic node
    }
}
```

```python
# Python parser example
def map_node_to_intent(node):
    node_type = node.__class__.__name__
    
    if node_type in ['Import', 'ImportFrom']:
        return INTENTS['import']  # returns "import"
        
    elif node_type in ['FunctionDef', 'AsyncFunctionDef', 'ClassDef']:
        return INTENTS['definition']  # returns "definition"
        
    elif node_type == 'Call':
        return INTENTS['call']  # returns "call"
        
    # Python doesn't have explicit exports, handle via __all__ or other conventions
    
    return None  # Not a semantic node
```

```go
// Go parser example
func MapNodeToIntent(node ast.Node) string {
    switch node.(type) {
    case *ast.ImportSpec:
        return INTENTS["import"]  // returns "import"
        
    case *ast.FuncDecl, *ast.TypeSpec:
        return INTENTS["definition"]  // returns "definition"
        
    case *ast.CallExpr:
        return INTENTS["call"]  // returns "call"
        
    default:
        return ""  // Not a semantic node
    }
}
```

### 3. Create Semantic Node Output

```javascript
// Example output
{
  "id": "/project/src/app.js:5:0:ImportDeclaration",
  "intent": "import",  // ← Using base intent
  "name": "React",
  "target": "react",
  "location": { /* ... */ },
  "weight": 0.9
}
```

---

## Extending with Custom Intents

If you need additional semantic information beyond the base four intents, you can extend them:

### Creating Extended Intents File

```json
{
  "version": "1.0.0",
  "description": "My Custom Extended Intents",
  "extends": "base-intents.json",
  
  "intents": {
    "import": "import",
    "export": "export",
    "definition": "definition",
    "call": "call",
    
    "inheritance": "inheritance",
    "implementation": "implementation",
    "type_reference": "type_reference",
    "decorator": "decorator"
  }
}
```

### Using Extended Intents

```javascript
// Load your extended intents instead of base
import extendedIntents from './my-extended-intents.json';

const INTENTS = extendedIntents.intents;

function mapNodeToIntent(node) {
    switch (node.type) {
        // Base intents
        case 'ImportDeclaration':
            return INTENTS.import;
            
        // Extended intents
        case 'ClassDeclaration':
            if (node.superClass) {
                return INTENTS.inheritance;  // Custom intent
            }
            return INTENTS.definition;
            
        case 'TSInterfaceDeclaration':
            return INTENTS.type_reference;  // Custom intent
            
        case 'Decorator':
            return INTENTS.decorator;  // Custom intent
            
        default:
            return null;
    }
}
```

### Example Extended Semantic Node

```json
{
  "id": "/project/src/app.js:10:0:ClassDeclaration",
  "intent": "inheritance",  // ← Extended intent
  "name": "MyComponent",
  "target": "React.Component",
  "location": { /* ... */ },
  "weight": 0.75,
  "metadata": {
    "superClass": "React.Component"
  }
}
```

---

## Guidelines for Custom Intents

### ✅ DO

- **Keep intents semantic, not syntactic**
  - Good: `"inheritance"` (semantic meaning)
  - Bad: `"extends_keyword"` (syntax detail)

- **Use simple, lowercase strings**
  - Good: `"type_reference"`
  - Bad: `"TypeReference"`, `"type-reference"`

- **Document what each custom intent means**
  - Explain when to use it
  - Provide examples from multiple languages

- **Remain language-agnostic**
  - Good: `"inheritance"` (works for JS, Python, Java)
  - Bad: `"java_extends"` (language-specific)

### ❌ DON'T

- **Don't create intents for every AST node type**
  - The goal is semantic abstraction, not AST duplication
  
- **Don't use language-specific terms**
  - Bad: `"rust_trait"`, `"python_decorator"`
  - Good: `"implementation"`, `"decorator"`

- **Don't break the base contract**
  - Always include the four base intents
  - Extended intents should be additive

---

## Complete Examples

### Minimal Parser (Base Intents Only)

```json
{
  "success": true,
  "language": "python",
  "filePath": "/project/app.py",
  "semanticNodes": [
    {
      "id": "/project/app.py:1:0:Import",
      "intent": "import",
      "name": "os",
      "target": "os",
      "weight": 0.9
    },
    {
      "id": "/project/app.py:3:0:FunctionDef",
      "intent": "definition",
      "name": "main",
      "weight": 0.7
    },
    {
      "id": "/project/app.py:4:4:Call",
      "intent": "call",
      "name": "print",
      "target": "print",
      "weight": 0.3
    }
  ]
}
```

### Advanced Parser (Extended Intents)

```json
{
  "success": true,
  "language": "typescript",
  "filePath": "/project/app.ts",
  "semanticNodes": [
    {
      "id": "/project/app.ts:1:0:ImportDeclaration",
      "intent": "import",
      "name": "Component",
      "target": "react"
    },
    {
      "id": "/project/app.ts:3:0:ClassDeclaration",
      "intent": "inheritance",
      "name": "MyComponent",
      "target": "Component"
    },
    {
      "id": "/project/app.ts:3:0:ClassDeclaration",
      "intent": "implementation",
      "name": "MyComponent",
      "target": "IClickable"
    },
    {
      "id": "/project/app.ts:4:2:MethodDefinition",
      "intent": "definition",
      "name": "render"
    },
    {
      "id": "/project/app.ts:5:4:CallExpression",
      "intent": "call",
      "name": "createElement",
      "target": "React.createElement"
    }
  ]
}
```

---

## Intent Usage in Graph Building

Once the semantic layer receives nodes with intents, the graph builder processes them uniformly:

```typescript
// In structura-core (TypeScript)
function buildGraph(semanticNodes: SemanticNode[]): Graph {
    const graph = new Graph();
    
    for (const node of semanticNodes) {
        // Add node to graph
        graph.addNode(node);
        
        // Create edges based on intent
        switch (node.intent) {
            case 'import':
                // Create dependency edge: current file → imported module
                graph.addEdge(node.id, resolveTarget(node.target), 'dependency');
                break;
                
            case 'call':
                // Create call edge: caller → callee
                graph.addEdge(node.id, resolveTarget(node.target), 'calls');
                break;
                
            case 'inheritance':  // Extended intent
                // Create inheritance edge: child → parent
                graph.addEdge(node.id, node.target, 'extends');
                break;
                
            // ... handle other intents
        }
    }
    
    return graph;
}
```

---

## Validation

Your parser output will be validated against this schema:

```typescript
interface SemanticNode {
  id: string;
  intent: string;  // MUST be one of the defined intents
  name: string;
  target?: string;
  location: SourceLocation;
  weight: number;
  metadata?: Record<string, any>;
}
```

**Validation checks:**

1. ✅ `intent` value exists in your intents definition
2. ✅ `intent` matches one of: `"import" | "export" | "definition" | "call"` (base)
3. ✅ If using extended intents, they're documented in your parser's intent file
4. ✅ `target` is present when required (imports, calls, etc.)

---

## Summary

**Base System:**
```
base-intents.json → Your Parser → Semantic Nodes → Structura Core Graph
```

**Extended System:**
```
base-intents.json + your-extended-intents.json → Your Parser → Semantic Nodes → Structura Core Graph
```

**Key Principles:**
1. ✅ Always implement the 4 base intents
2. ✅ Extend only when needed for richer semantics
3. ✅ Keep intents language-agnostic
4. ✅ Document your custom intents clearly
5. ✅ Output valid JSON matching the contract

This system provides the perfect balance between **standardization** (base intents) and **flexibility** (extensions).