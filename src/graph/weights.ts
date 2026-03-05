export const WEIGHTS = {
    // Type/Interface definitions (highest weight - core architecture)
    class: 10,
    interface: 8,
    type: 8,              // Type aliases
    enum: 6,
    abstract: 9,           // Abstract classes/methods
    decorator: 7,          // Decorators
    
    // Functions and methods
    function: 5,
    method: 5,             // Class methods
    arrow: 4,              // Arrow functions
    async: 4,              // Async functions
    generator: 4,          // Generator functions
    constructor: 5,        // Class constructors
    getter: 3,             // Getters
    setter: 3,             // Setters
    
    // Variables and declarations
    variable: 3,
    constant: 3,           // const declarations
    let: 3,                // let declarations
    parameter: 2,          // Function parameters
    property: 3,           // Class/Object properties
    field: 3,              // Class fields
    static: 4,             // Static members
    
    // Control flow
    if: 2,
    else: 1,
    switch: 2,
    case: 1,
    for: 2,
    while: 2,
    do: 2,
    break: 1,
    continue: 1,
    return: 2,
    throw: 2,
    try: 3,
    catch: 2,
    finally: 1,
    
    // Operators and expressions
    ternary: 2,            // Ternary operators
    nullish: 1,            // ?? operator
    optional: 2,           // ?. optional chaining
    spread: 2,             // ... spread operator
    rest: 2,               // ... rest parameters
    destructure: 3,        // Destructuring assignment
    
    // Data types
    string: 1,
    number: 1,
    boolean: 1,
    null: 1,
    undefined: 1,
    symbol: 2,
    bigint: 2,
    any: 2,                // TypeScript any
    unknown: 3,            // TypeScript unknown
    never: 3,              // TypeScript never
    void: 2,
    
    // Data structures
    array: 2,
    object: 2,
    tuple: 3,              // TypeScript tuples
    record: 3,             // TypeScript Record
    map: 3,                // Map data structure
    set: 3,                // Set data structure
    weakmap: 2,
    weakset: 2,
    promise: 4,            // Promises
    observable: 4,         // Observables
    
    // Modules and imports
    import: 4,
    export: 4,
    default: 3,            // Default exports
    from: 2,
    require: 3,            // CommonJS require
    
    // TypeScript specific
    namespace: 5,
    module: 5,
    declare: 4,            // Declaration files
    readonly: 3,           // Readonly modifier
    keyof: 3,              // keyof operator
    infer: 4,              // infer keyword
    satisfies: 3,          // satisfies operator
    
    // Access modifiers
    public: 2,
    private: 2,
    protected: 2,
    
    // Utility types
    partial: 3,            // Partial<T>
    required: 3,           // Required<T>
    readonly_util: 3,      // Readonly<T>
    pick: 4,               // Pick<T>
    omit: 4,               // Omit<T>
    exclude: 3,            // Exclude<T>
    extract: 3,            // Extract<T>
    nonnullable: 3,        // NonNullable<T>
    return_type: 4,        // ReturnType<T>
    parameter_type: 4,     // Parameters<T>
    
    // JSX/React specific
    component: 6,          // React components
    hook: 5,               // React hooks
    jsx: 3,                // JSX elements
    fragment: 2,           // React fragments
    props: 3,              // Component props
    state: 4,              // Component state
    effect: 4,             // useEffect
    context: 4,            // React Context
    ref: 3,                // Refs
    memo: 3,               // React.memo
    callback: 3,           // useCallback
    reducer: 4,            // useReducer
    
    // Testing related
    test: 3,
    describe: 2,
    it: 2,
    expect: 2,
    assert: 2,
    mock: 3,
    spy: 3,
    
    // Comments and documentation
    comment_single: 0,     // // comments
    comment_multi: 0,      // /* */ comments
    jsdoc: 2,              // JSDoc comments
    todo: 1,               // TODO comments
    fixme: 1,              // FIXME comments
    
    // Common patterns
    singleton: 5,          // Singleton pattern
    factory: 5,            // Factory pattern
    observer: 5,           // Observer pattern
    decorator_pattern: 6,  // Decorator pattern
    proxy: 4,              // Proxy pattern
    module_pattern: 4,     // Module pattern
    
    // Error handling
    error: 3,
    exception: 3,
    finally_block: 1,
    
    // Async patterns
    await: 3,
    resolve: 2,
    reject: 2,
    then: 2,
    catch_method: 2,
    finally_method: 1,
    
    // Configuration and metadata
    config: 3,
    metadata: 3,
    annotation: 3,
    
    // Build and tooling
    webpack: 2,
    babel: 2,
    typescript: 3,
    eslint: 2,
    prettier: 1,
    
    // Framework specific (generic)
    route: 4,              // API routes
    middleware: 4,         // Middleware
    controller: 5,         // Controllers
    service: 5,            // Services
    repository: 5,         // Repository pattern
    dto: 4,                // Data Transfer Objects
    model: 5,              // Data models
    schema: 4,             // Schemas
    migration: 3,          // Database migrations
    seed: 2,               // Database seeds
    
    // Environment and configuration
    env: 2,                // Environment variables
    dotenv: 1,
    
    // Logging and debugging
    log: 1,
    debug: 2,
    info: 1,
    warn: 1,
    error_log: 2,
    console: 1
};