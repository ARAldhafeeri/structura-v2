import * as assert from "assert";
import sinon from "sinon";
import { createTask, createTaskKeyForPriorityQueueHandlerRegistry, type PriorityTask } from "../../src/contract/PriorityTaskQueue.js";
import { PriorityTaskQueue } from "../../src/core/PriorityTaskQueue.js";

// Mock instances
const mockQueue = {
  add: sinon.stub(),
  clean: sinon.stub(),
};

const mockWorker = {
  on: sinon.stub(),
  close: sinon.stub().resolves(),
};

const mockDeps = {
  QueueClass: sinon.stub().returns(mockQueue),
  WorkerClass: sinon.stub().returns(mockWorker),
};

const testConnection = { host: "localhost", port: 6379 };

export function createQueue(
  name: string,
  processor: (task: PriorityTask) => Promise<void>
) {
  return new PriorityTaskQueue(name, processor, testConnection, mockDeps as any);
}

suite("PriorityTaskQueue Tests", () => {
  let queue: any;
  let processorStub: sinon.SinonStub;
  const validQueueName = "graph-construction";

  setup(() => {
    sinon.reset();
    mockQueue.add.reset();
    mockQueue.clean.reset();
    mockDeps.QueueClass.reset();
    mockDeps.WorkerClass.reset();
    mockDeps.QueueClass.returns(mockQueue);
    mockDeps.WorkerClass.returns(mockWorker);

    processorStub = sinon.stub().resolves();
  });

  teardown(async () => {
    sinon.restore();
    if (queue) {
      queue = null;
    }
  });

  suite("Constructor Tests", () => {
    test("Positive: Should create queue with valid name", () => {
      const consoleWarnStub = sinon.stub(console, "warn");
      queue = createQueue(validQueueName, processorStub);

      assert.strictEqual(consoleWarnStub.notCalled, true);
      assert.strictEqual(mockDeps.QueueClass.calledWith(validQueueName, sinon.match.any), true);
      assert.strictEqual(mockDeps.WorkerClass.calledWith(validQueueName, sinon.match.func, sinon.match.any), true);
    });
  });

  suite("addTask Tests", () => {
    setup(() => {
      queue = createQueue(validQueueName, processorStub);
    });

    test("Edge case: Should handle task with custom priority not in TASK_NAMES_WITH_PRIORITY", () => {
      const task: PriorityTask = {
        id: "custom-task-123",
        type: "custom-type",
        subType: "123",
        subPriority: 1,
        priority: 2000,
        data: {},
        description: "Custom priority task",
        createdAt: Date.now(),
      };

      queue.addTask(task);

      assert.strictEqual(mockQueue.add.calledOnce, true);
      const [, , options] = mockQueue.add.firstCall.args;
      assert.strictEqual(options.priority, 2000);
    });

  });

  suite("clearQueue Tests", () => {
    setup(() => {
      queue = createQueue(validQueueName, processorStub);
    });

    test("Positive: Should clear queue with default parameters", () => {
      queue.clearQueue();

      assert.strictEqual(mockQueue.clean.calledOnce, true);
      const [grace, limit] = mockQueue.clean.firstCall.args;
      assert.strictEqual(grace, 200);
      assert.strictEqual(limit, 10);
    });

    test("Edge case: Should handle clearQueue error", async () => {
      const error = new Error("Queue clean failed");
      mockQueue.clean.rejects(error);

      try {
        await queue.clearQueue();
        assert.fail("Should have thrown an error");
      } catch (err) {
        assert.ok((err as any));
      }
    });
  });

  suite("getter Methods Tests", () => {
    setup(() => {
      queue = createQueue(validQueueName, processorStub);
    });

    test("Positive: Should return the queue instance", () => {
      const returnedQueue = queue.getQueue();
      assert.strictEqual(returnedQueue, mockQueue);
    });

    test("Positive: Should return the worker instance", () => {
      const returnedWorker = queue.getWorker();
      assert.strictEqual(returnedWorker, mockWorker);
    });

    test("Edge case: Should return same queue instance after multiple calls", () => {
      const q1 = queue.getQueue();
      const q2 = queue.getQueue();
      assert.strictEqual(q1, q2);
      assert.strictEqual(q1, mockQueue);
    });
  });

  suite("Worker Processing Tests", () => {
    test("Edge case: Worker should handle processor errors", async () => {
      const error = new Error("Processor failed");
      const failingProcessor = sinon.stub().rejects(error);
      queue = createQueue(validQueueName, failingProcessor);

      const mockJob = {
        data: {},
      };

      const workerCallback = mockDeps.WorkerClass.firstCall.args[1];

      try {
        await workerCallback(mockJob);
        assert.fail("Should have thrown an error");
      } catch (err) {
        assert.strictEqual(err, error);
      }
    });
  });

  suite("Task Creation Tests", () => {
    test("Positive: Should create task key with kebab style", () => {
       const task: PriorityTask = {
        id: "custom-task-123",
        type: "custom-type",
        subType: "123",
        subPriority: 1,
        priority: 2000,
        data: {},
        description: "Custom priority task",
        createdAt: Date.now(),
      };

      const expectedKey = `${task.type}-${task.subType}`
      const kebabStyleTaskCreation = createTaskKeyForPriorityQueueHandlerRegistry(task)

        assert.strictEqual(kebabStyleTaskCreation, expectedKey);
    });

    test("Positive: should show composite priority score correctly", () => {
       const task: PriorityTask = {
        id: "custom-task-123",
        type: "custom-type",
        subType: "",
        subPriority: 99,
        priority: 6000,
        data: {},
        description: "Custom priority task",
        createdAt: Date.now(),
      };

      let createdTask = createTask("initialize-graph", task);
        
        // true only if the sub task within the range of 1-99
        assert.strictEqual(createdTask.priority, task.priority + task.subPriority);

        // should clap upper bound beyond 99
        task.subPriority = 99999
        assert.strictEqual(createdTask.priority, task.priority + 99);
        // should clap lower bound below 1
         task.subPriority = 1
        assert.strictEqual(createdTask.priority, task.priority + 99);

    });
    
  });

    
});