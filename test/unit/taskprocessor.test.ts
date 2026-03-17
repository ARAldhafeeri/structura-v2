import * as assert from "assert";
import sinon from "sinon";
import { TaskProcessor, TaskProcessorRegistry } from "../../src/core/TaskProcessor.js";
import type { PriorityTask, TASK_NAME } from "../../src/contract/PriorityTaskQueue.js";

suite("TaskProcessor Tests", () => {
  let registry: TaskProcessorRegistry;
  let processor: TaskProcessor;
  let mockRegistryMap: Map<TASK_NAME, sinon.SinonStub>;

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
    const taskType: TASK_NAME = "graph-construction";
    const mockHandler = sinon.stub().resolves(true);

    test("Positive: Should add processor to registry", () => {
      registry.add(taskType, mockHandler);
      assert.strictEqual(mockRegistryMap.get(taskType), mockHandler);
    });

    test("Positive: Should get processor from registry", () => {
      mockRegistryMap.set(taskType, mockHandler);
      const result = registry.get(taskType);
      assert.strictEqual(result, mockHandler);
    });

    test("Edge case: Should return undefined for non-existent type", () => {
      const result = registry.get("non-existent" as TASK_NAME);
      assert.strictEqual(result, undefined);
    });

    test("Positive: Should remove processor from registry", () => {
      mockRegistryMap.set(taskType, mockHandler);
      registry.remove(taskType);
      assert.strictEqual(mockRegistryMap.has(taskType), false);
    });

    test("Edge case: Should handle removing non-existent type", () => {
      assert.doesNotThrow(() => registry.remove("non-existent" as TASK_NAME));
    });

    test("Positive: Should clean all registry entries", () => {
      mockRegistryMap.set(taskType, mockHandler);
      mockRegistryMap.set("user-interaction" as TASK_NAME, sinon.stub());
      
      registry.clean();
      assert.strictEqual(mockRegistryMap.size, 0);
    });

    test("Edge case: Should handle cleaning empty registry", () => {
      assert.doesNotThrow(() => registry.clean());
    });
  });

  suite("TaskProcessor Tests", () => {
    const taskType: TASK_NAME = "graph-construction";
    const mockTask: PriorityTask = {
      id: "task-123",
      type: taskType,
      priority: 60,
      description: "Test task",
      createdAt: Date.now()
    };

    test("Positive: Should process task successfully", async () => {
      const mockHandler = sinon.stub().resolves(true);
      registry.add(taskType, mockHandler);

      const result = await processor.process(taskType, mockTask);

      assert.strictEqual(result, true);
      assert.strictEqual(mockHandler.calledOnceWith(mockTask), true);
    });

    test("Edge case: Should return false when no processor registered", async () => {
     
      const result = await processor.process("not-reg" as any, mockTask);

      assert.strictEqual(result, false);

    });

    test("Edge case: Should return false when processor returns false", async () => {
      const mockHandler = sinon.stub().resolves(false);
      registry.add(taskType, mockHandler);

      const result = await processor.process(taskType, mockTask);

      assert.strictEqual(result, false);
      assert.strictEqual(mockHandler.calledOnceWith(mockTask), true);
    });

    test("Edge case: Should handle processor throwing error", async () => {
      const error = new Error("Processor failed");
      const mockHandler = sinon.stub().rejects(error);
      registry.add(taskType, mockHandler);

      await assert.rejects(
        () => processor.process(taskType, mockTask),
        error
      );
    });

    test("Positive: Should process multiple task types", async () => {
      const handler1 = sinon.stub().resolves(true);
      const handler2 = sinon.stub().resolves(true);
      
      registry.add("graph-construction" as TASK_NAME, handler1);
      registry.add("user-interaction" as TASK_NAME, handler2);

      const task1 = { ...mockTask, type: "graph-construction" };
      const task2 = { ...mockTask, type: "user-interaction" };

      const result1 = await processor.process("graph-construction" as TASK_NAME, task1);
      const result2 = await processor.process("user-interaction" as TASK_NAME, task2);

      assert.strictEqual(result1, true);
      assert.strictEqual(result2, true);
      assert.strictEqual(handler1.calledOnceWith(task1), true);
      assert.strictEqual(handler2.calledOnceWith(task2), true);
    });
  });
});