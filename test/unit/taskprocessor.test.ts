import * as assert from "assert";
import sinon from "sinon";
import { TaskProcessor, TaskProcessorRegistry } from "../../src/core/TaskProcessor.js";
import { createTaskKeyForPriorityQueueHandlerRegistry, type PriorityTask, type TaskCategory } from "../../src/contract/PriorityTaskQueue.js";

suite("TaskProcessor Tests", () => {
  let registry: TaskProcessorRegistry;
  let processor: TaskProcessor;
  let mockRegistryMap: Map<PriorityTask, sinon.SinonStub>;

  setup(() => {
    mockRegistryMap = new Map();
    registry = new TaskProcessorRegistry(mockRegistryMap as any);
    processor = new TaskProcessor(registry);
  });

  teardown(() => {
    registry.clean()
    sinon.restore();
  });

  suite("TaskProcessorRegistry Tests", () => {
    const taskType: TaskCategory = "graph-construction";
    const mockHandler = sinon.stub().resolves(true);

    test("Positive: Should add processor to registry", () => {
        const mockTask: PriorityTask = {
            id: "task-123",
            type: taskType,
            subType: "123",
            priority: 6000,
            data: {},
            subPriority: 1,
            description: "Test task",
            createdAt: Date.now()
        };
      registry.add(mockTask, mockHandler);
      assert.strictEqual(mockRegistryMap.get(createTaskKeyForPriorityQueueHandlerRegistry(mockTask) as any), mockHandler);
    });

    test("Positive: Should get processor from registry", () => {
        const mockTask: PriorityTask = {
            id: "task-123",
            type: taskType,
            subType: "123",
            priority: 6000,
            data: {},
            subPriority: 1,
            description: "Test task",
            createdAt: Date.now()
        };
      mockRegistryMap.set(createTaskKeyForPriorityQueueHandlerRegistry(mockTask) as any, mockHandler);
      const result = registry.get(mockTask);
      assert.strictEqual(result, mockHandler);
    });

    test("Edge case: Should return undefined for non-existent type", () => {
        const mockTask: PriorityTask = {
            id: "task-123",
            type: taskType,
            subType: "123",
            priority: 6000,
            data: {},
            subPriority: 1,
            description: "Test task",
            createdAt: Date.now()
        };
      const result = registry.get({} as any);
      assert.strictEqual(result, undefined);
    });

    test("Positive: Should remove processor from registry", () => {
        const mockTask: PriorityTask = {
            id: "task-123",
            type: taskType,
            subType: "123",
            priority: 6000,
            data: {},
            subPriority: 1,
            description: "Test task",
            createdAt: Date.now()
        };
      mockRegistryMap.set(createTaskKeyForPriorityQueueHandlerRegistry(mockTask) as any, mockHandler);
      registry.remove(mockTask);
      assert.strictEqual(mockRegistryMap.has(mockTask), false);
    });

    test("Edge case: Should handle removing non-existent type", () => {
      assert.doesNotThrow(() => registry.remove({} as any));
    });

    test("Positive: Should clean all registry entries", () => {
      mockRegistryMap.set({task: 1} as any , mockHandler);
      mockRegistryMap.set({task : 2} as any, sinon.stub());
      
      registry.clean();
      assert.strictEqual(mockRegistryMap.size, 0);
    });

    test("Edge case: Should handle cleaning empty registry", () => {
      assert.doesNotThrow(() => registry.clean());
    });
  });

  suite("TaskProcessor Tests", () => {
    const taskType: TaskCategory = "graph-construction";
    const mockTask: PriorityTask = {
        id: "task-123",
        type: taskType,
        subType: "123",
        priority: 6000,
        data: {},
        subPriority: 1,
        description: "Test task",
        createdAt: Date.now()
    };

    test("Positive: Should process task successfully", async () => {
      const mockHandler = sinon.stub().resolves(true);
      registry.add(mockTask, mockHandler);

      const result = await processor.process(mockTask);

      assert.strictEqual(result, true);
      assert.strictEqual(mockHandler.calledOnceWith(mockTask), true);
    });

    test("Edge case: Should return false when no processor registered", async () => {
     
      const result = await processor.process(mockTask);

      assert.strictEqual(result, false);

    });

    test("Edge case: Should return false when processor returns false", async () => {
      const mockHandler = sinon.stub().resolves(false);
      registry.add(mockTask, mockHandler);

      const result = await processor.process(mockTask);

      assert.strictEqual(result, false);
      assert.strictEqual(mockHandler.calledOnceWith(mockTask), true);
    });

    test("Edge case: Should handle processor throwing error", async () => {
      const error = new Error("Processor failed");
      const mockHandler = sinon.stub().rejects(error);
      registry.add(mockTask, mockHandler);

      await assert.rejects(
        () => processor.process(mockTask),
        error
      );
    });

    test("Positive: Should process multiple task types", async () => {
    const task1: PriorityTask = {
        id: "task-1",
        type: "graph-construction",
        subType: "initialize-graph",  
        priority: 6000,
        data: {},
        subPriority: 1,
        description: "Graph construction task",
        createdAt: Date.now()
    };
    
    const task2: PriorityTask = {
        id: "task-2",
        type: "user-interaction",
        subType: "node-click", 
        priority: 5000,
        data: {},
        subPriority: 1,
        description: "User interaction task",
        createdAt: Date.now()
    };
    
    const handler1 = sinon.stub().resolves(true);
    const handler2 = sinon.stub().resolves(true);
    
    // Register each task with its own handler
    registry.add(task1, handler1);
    registry.add(task2, handler2);

    const result1 = await processor.process(task1);
    const result2 = await processor.process(task2);

    assert.strictEqual(result1, true);
    assert.strictEqual(result2, true);
    assert.strictEqual(handler1.calledOnceWith(task1), true);
    assert.strictEqual(handler2.calledOnceWith(task2), true);
});
  });
});