import * as assert from "assert";
import sinon from "sinon";
import { StracturaQueueTasks, type PriorityTask } from "../../src/contract/PriorityTaskQueue.js";
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

    test("Positive: Should add valid task to queue", () => {
      const task: PriorityTask = StracturaQueueTasks.getGraphConstructionTask(
        "Test graph construction"
      );

      queue.addTask(task);

      assert.strictEqual(mockQueue.add.calledOnce, true);
      const [jobId, jobData, options] = mockQueue.add.firstCall.args;
      assert.strictEqual(jobId, task.id);
      assert.deepStrictEqual(jobData, task);
      assert.deepStrictEqual(options, { priority: task.priority });
    });

    test("Edge case: Should add task with minimum priority (10)", () => {
      const task: PriorityTask = StracturaQueueTasks.getOtherTask(
        "Low priority task"
      );

      queue.addTask(task);

      assert.strictEqual(mockQueue.add.calledOnce, true);
      const [, , options] = mockQueue.add.firstCall.args;
      assert.strictEqual(options.priority, 10);
    });

    test("Edge case: Should add task with maximum priority (60)", () => {
      const task: PriorityTask = StracturaQueueTasks.getGraphConstructionTask(
        "High priority task"
      );

      queue.addTask(task);

      assert.strictEqual(mockQueue.add.calledOnce, true);
      const [, , options] = mockQueue.add.firstCall.args;
      assert.strictEqual(options.priority, 60);
    });

    test("Edge case: Should handle task with custom priority not in TASK_NAMES_WITH_PRIORITY", () => {
      const task: PriorityTask = {
        id: "custom-task-123",
        type: "custom-type",
        priority: 25,
        description: "Custom priority task",
        createdAt: Date.now(),
      };

      queue.addTask(task);

      assert.strictEqual(mockQueue.add.calledOnce, true);
      const [, , options] = mockQueue.add.firstCall.args;
      assert.strictEqual(options.priority, 25);
    });

    test("Edge case: Should handle adding multiple tasks", () => {
      const tasks = [
        StracturaQueueTasks.getGraphConstructionTask("Task 1"),
        StracturaQueueTasks.getUserInteractionTask("Task 2"),
        StracturaQueueTasks.getBackgroundProcessingTask("Task 3"),
      ];

      tasks.forEach((task) => queue.addTask(task));

      assert.strictEqual(mockQueue.add.callCount, 3);
      tasks.forEach((task, index) => {
        const [jobId, , options] = mockQueue.add.getCall(index).args;
        assert.strictEqual(jobId, task.id);
        assert.strictEqual(options.priority, task.priority);
      });
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
    test("Positive: Should process tasks through worker", async () => {
      const processorSpy = sinon.spy();
      queue = createQueue(validQueueName, processorSpy as any);

      const mockJob = {
        data: StracturaQueueTasks.getGraphConstructionTask("Test task"),
      };

      // Grab the callback passed as 2nd arg to WorkerClass(name, callback, opts)
      const workerCallback = mockDeps.WorkerClass.firstCall.args[1];
      await workerCallback(mockJob);

      assert.strictEqual(processorSpy.calledOnce, true);
      assert.deepStrictEqual(processorSpy.firstCall.args[0], mockJob.data);
    });

    test("Edge case: Worker should handle processor errors", async () => {
      const error = new Error("Processor failed");
      const failingProcessor = sinon.stub().rejects(error);
      queue = createQueue(validQueueName, failingProcessor);

      const mockJob = {
        data: StracturaQueueTasks.getGraphConstructionTask("Failing task"),
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
    test("Positive: Should create all task types with correct priorities", () => {
      const tasks = [
        StracturaQueueTasks.getGraphConstructionTask("Graph task"),
        StracturaQueueTasks.getUserInteractionTask("UI task"),
        StracturaQueueTasks.getBackgroundProcessingTask("Background task"),
        StracturaQueueTasks.getLocalIndexingTask("Indexing task"),
        StracturaQueueTasks.getSnapshottingTask("Snapshot task"),
        StracturaQueueTasks.getOtherTask("Other task"),
      ];

      const expectedPriorities = [60, 50, 40, 30, 20, 10];

      tasks.forEach((task, index) => {
        assert.strictEqual(task.priority, expectedPriorities[index]);
        assert.ok(task.id.startsWith("task-"));
        assert.ok(task.createdAt <= Date.now());
      });
    });

    test("Edge case: Tasks created sequentially should have unique IDs", () => {
      const clock = sinon.useFakeTimers();
      const task1 = StracturaQueueTasks.getGraphConstructionTask("Task 1");
      clock.tick(1);
      const task2 = StracturaQueueTasks.getGraphConstructionTask("Task 2");
      clock.restore();

      assert.notStrictEqual(task1.id, task2.id);
    });
  });
});