```Merimiad 
flowchart LR

%% USER SIDE
U[Developer\nVS Code Editor\nTabs • Files • Workspace]

FS[(Project File System)]

%% EXTENSION
subgraph VSCode_Extension_Runtime
    CFG[Config & Settings\nMarkdown / JSON]
    WATCH[File Watcher]
    QUEUE[[Processing Queue]]
end

%% ANALYSIS ENGINE
subgraph Code_Analysis_Engine
    PARSER[Language Parser\nAST Extraction]
    IR[Semantic IR\nNormalized Representation]
    GRAPH[Code Graph Builder]
end

%% STATE LAYER
subgraph Persistence
    CACHE[(Cache)]
    STATE[(State Snapshot)]
end

%% VISUALIZATION
VIS[Visualization Layer\nGraph Queries]

%% FLOWS
U --> FS
FS --> WATCH
WATCH --> QUEUE

CFG --> QUEUE

QUEUE --> PARSER
PARSER --> IR
IR --> GRAPH

GRAPH --> CACHE
GRAPH --> STATE

STATE --> VIS
VIS --> VSCode_Extension_Runtime
VSCode_Extension_Runtime --> U

```