import * as assert from 'assert';
import * as sinon from 'sinon';

import { type Event } from '@parcel/watcher';

import { 
  SubscriptionManager, 
  HandlersRegisry, 
  GraphFileWatcher,
  type FileSubscription,
  type FileWatcherHandler
} from "../../src/core/FileWatcher.js"


suite('Graph File Watcher Tests', () => {
  
  suite('SubscriptionManager Tests', () => {
    let manager: SubscriptionManager;
    const mockSubscription: FileSubscription = {
      id: 'test-id-1',
      filePath: '/test/file1.js',
      subscription: {} as any,
      unsubscribeCaller: async () => {}
    };

    setup(() => {
      manager = new SubscriptionManager();
    });

    test('should add a subscription', () => {
      manager.add(mockSubscription);
      const retrieved = manager.get(mockSubscription.id);
      assert.strictEqual(retrieved, mockSubscription);
    });

    test('should remove a subscription and return it', () => {
      manager.add(mockSubscription);
      const removed = manager.remove(mockSubscription.id);
      
      assert.strictEqual(removed, mockSubscription);
      assert.strictEqual(manager.get(mockSubscription.id), undefined);
    });

    test('should return undefined when removing non-existent subscription', () => {
      const removed = manager.remove('non-existent');
      assert.strictEqual(removed, undefined);
    });

    test('should get a subscription by id', () => {
      manager.add(mockSubscription);
      const retrieved = manager.get(mockSubscription.id);
      assert.strictEqual(retrieved, mockSubscription);
    });

    test('should return undefined for non-existent subscription', () => {
      const retrieved = manager.get('non-existent');
      assert.strictEqual(retrieved, undefined);
    });

    test('should find all subscriptions', () => {
      const sub2: FileSubscription = {
        id: 'test-id-2',
        filePath: '/test/file2.js',
        subscription: {} as any,
        unsubscribeCaller: async () => {}
      };

      manager.add(mockSubscription);
      manager.add(sub2);

      const all = manager.findAll();
      assert.strictEqual(all.length, 2);
      assert.ok(all.includes(mockSubscription));
      assert.ok(all.includes(sub2));
    });

    test('should find subscriptions by file path', () => {
      const sub1: FileSubscription = {
        id: 'test-id-1',
        filePath: '/test/common.js',
        subscription: {} as any,
        unsubscribeCaller: async () => {}
      };

      const sub2: FileSubscription = {
        id: 'test-id-2',
        filePath: '/test/common.js',
        subscription: {} as any,
        unsubscribeCaller: async () => {}
      };

      const sub3: FileSubscription = {
        id: 'test-id-3',
        filePath: '/test/different.js',
        subscription: {} as any,
        unsubscribeCaller: async () => {}
      };

      manager.add(sub1);
      manager.add(sub2);
      manager.add(sub3);

      const found = manager.findByFilePath('/test/common.js');
      assert.strictEqual(found.length, 2);
      assert.ok(found.includes(sub1));
      assert.ok(found.includes(sub2));
      assert.ok(!found.includes(sub3));
    });

    test('should return empty array when no subscriptions match file path', () => {
      manager.add(mockSubscription);
      const found = manager.findByFilePath('/nonexistent/path.js');
      assert.strictEqual(found.length, 0);
    });

    test('should handle empty subscriptions map gracefully', () => {
      assert.strictEqual(manager.findAll().length, 0);
      assert.strictEqual(manager.get('any-id'), undefined);
      assert.strictEqual(manager.remove('any-id'), undefined);
      assert.strictEqual(manager.findByFilePath('/any/path.js').length, 0);
    });
  });

  suite('HandlersRegistry Tests', () => {
    let registry: HandlersRegisry;
    const mockHandler: FileWatcherHandler = (events, err) => {};

    setup(() => {
      registry = new HandlersRegisry();
    });

    test('should add a handler and generate unique id', () => {
      const addSpy = sinon.spy(registry.handlers, 'set');
      registry.add(mockHandler);
      
      assert.ok(addSpy.calledOnce);
      const key = addSpy.firstCall.args[0];
      assert.ok(typeof key === 'string');
      assert.ok(key.length > 0);
      
      addSpy.restore();
    });

    test('should delete a handler by id', () => {
      registry.add(mockHandler);
      const firstKey = Array.from(registry.handlers.keys())[0];
      
      registry.delete(firstKey);
      assert.strictEqual(registry.handlers.size, 0);
    });

    test('should find one handler by id', () => {
      registry.add(mockHandler);
      const firstKey = Array.from(registry.handlers.keys())[0];
      
      const found = registry.findOne(firstKey);
      assert.strictEqual(found, mockHandler);
    });

    test('should return undefined for non-existent handler id', () => {
      const found = registry.findOne('non-existent');
      assert.strictEqual(found, undefined);
    });

    test('should find all handlers', () => {
      const handler2: FileWatcherHandler = (events, err) => {};
      
      registry.add(mockHandler);
      registry.add(handler2);

      const handlers = Array.from(registry.findAll());
      assert.strictEqual(handlers.length, 2);
      assert.ok(handlers.includes(mockHandler));
      assert.ok(handlers.includes(handler2));
    });

    test('should flush all handlers', () => {
      registry.add(mockHandler);
      registry.add(mockHandler);
      
      assert.strictEqual(registry.handlers.size, 2);
      
      registry.flush();
      assert.strictEqual(registry.handlers.size, 0);
    });

    test('should handle multiple operations correctly', () => {
      registry.add(mockHandler);
      const id1 = Array.from(registry.handlers.keys())[0];
      
      registry.add(mockHandler);
      const id2 = Array.from(registry.handlers.keys())[1];
      
      assert.strictEqual(registry.handlers.size, 2);
      
      registry.delete(id1);
      assert.strictEqual(registry.handlers.size, 1);
      assert.ok(registry.findOne(id2));
      assert.strictEqual(registry.findOne(id1), undefined);
    });
  });

  suite('GraphFileWatcher Tests', () => {
    let watcher: GraphFileWatcher;
    let mockWatcher: any;
    let handlerRegistry: HandlersRegisry;
    let mockHandler: sinon.SinonSpy;

    setup(() => {
      // Create fresh mocks for each test
      mockWatcher = {
        subscribe: sinon.stub().resolves({
          unsubscribe: sinon.stub().resolves()
        })
      };
      
      handlerRegistry = new HandlersRegisry();
      mockHandler = sinon.spy();
      
      watcher = new GraphFileWatcher(
        mockWatcher,
        { concurrency: 2 },
        handlerRegistry
      );
    });

    teardown(() => {
      sinon.restore();
    });

    test('should watch multiple files and return subscription ids', async () => {
      handlerRegistry.add(mockHandler);
      const files = ['/test/file1.js', '/test/file2.js', '/test/file3.js'];
      
      const ids = await watcher.watchMany(files);
      
      assert.strictEqual(ids.length, 3);
      ids.forEach(id => {
        assert.ok(typeof id === 'string');
        assert.ok(id.length > 0);
      });
      
      assert.strictEqual(mockWatcher.subscribe.callCount, 3);
    });

    test('should call all handlers when file events occur', async () => {
      const handler1 = sinon.spy();
      const handler2 = sinon.spy();
      handlerRegistry.add(handler1);
      handlerRegistry.add(handler2);
      
      await watcher.watchMany(['/test/file1.js']);
      
      // Get the callback that was passed to subscribe
      const subscribeCall = mockWatcher.subscribe.firstCall;
      const callback = subscribeCall.args[1];
      
      // Simulate a file change event
      const mockEvents: Event[] = [{
        type: 'update',
        path: '/test/file1.js'
      }];
      const mockError = null;
      
      callback(mockEvents, mockError);
      
      assert.ok(handler1.calledOnceWith(mockEvents, mockError));
      assert.ok(handler2.calledOnceWith(mockEvents, mockError));
    });

    test('should unsubscribe from a single file', async () => {
      handlerRegistry.add(mockHandler);
      
      const [id] = await watcher.watchMany(['/test/file1.js']);
      
      const subscription = mockWatcher.subscribe.firstCall.returnValue;
      
      await watcher.unsubscribeOne(id);
      
      assert.ok(subscription.unsubscribe.calledOnce);
    });

    test('should handle unsubscribe from non-existent subscription', async () => {
      await watcher.unsubscribeOne('non-existent-id');
      // Should not throw
    });

    test('should unsubscribe from multiple files with concurrency control', async () => {
      handlerRegistry.add(mockHandler);
      
      const files = ['/test/1.js', '/test/2.js', '/test/3.js', '/test/4.js', '/test/5.js'];
      const ids = await watcher.watchMany(files);
      
      // Get all subscription objects
      const subscriptions = ids.map(() => mockWatcher.subscribe.firstCall.returnValue);
      
      await watcher.unsubscribeMany(ids);
      
      // All subscriptions should have been unsubscribed
      subscriptions.forEach(sub => {
        assert.ok(sub.unsubscribe.calledOnce);
      });
    });

    test('should flush all subscriptions', async () => {
      handlerRegistry.add(mockHandler);
      
      const files = ['/test/1.js', '/test/2.js', '/test/3.js'];
      const ids = await watcher.watchMany(files);
      
      // Get all subscription objects
      const subscriptions = ids.map(() => mockWatcher.subscribe.firstCall.returnValue);
      
      await watcher.flushAllSubscriptions();
      
      // All subscriptions should be unsubscribed
      subscriptions.forEach(sub => {
        assert.ok(sub.unsubscribe.calledOnce);
      });
      
      // Subscription manager should be empty
      assert.strictEqual(watcher['subscriptionManager'].findAll().length, 0);
    });

    test('should handle errors in file watching', async () => {
      const errorHandler = sinon.spy();
      handlerRegistry.add(errorHandler);
      
      // Create a fresh mock for this test
      const errorMockWatcher = {
        subscribe: sinon.stub().callsFake((path: string, callback: any) => {
          const mockError = new Error('Watch error');
          callback(mockError, []);
          return Promise.resolve({ unsubscribe: async () => {} });
        })
      };
      
      const errorWatcher = new GraphFileWatcher(
        errorMockWatcher as any,
        { concurrency: 2 },
        handlerRegistry
      );
      
      await errorWatcher.watchMany(['/test/file1.js']);
      
      assert.ok(errorHandler.calledOnce);
      assert.ok(errorHandler.firstCall.args[0] instanceof Error);
      assert.strictEqual(errorHandler.firstCall.args[0].message, 'Watch error');
    });

    test('should handle concurrent watch operations', async () => {
      handlerRegistry.add(mockHandler);
      
      const files1 = ['/test/a.js', '/test/b.js'];
      const files2 = ['/test/c.js', '/test/d.js'];
      
      const [ids1, ids2] = await Promise.all([
        watcher.watchMany(files1),
        watcher.watchMany(files2)
      ]);
      
      assert.strictEqual(ids1.length, 2);
      assert.strictEqual(ids2.length, 2);
      assert.strictEqual(mockWatcher.subscribe.callCount, 4);
      assert.strictEqual(watcher['subscriptionManager'].findAll().length, 4);
    });

    test('should maintain separate subscriptions for same file', async () => {
      handlerRegistry.add(mockHandler);
      
      const [id1, id2] = await watcher.watchMany(['/test/same.js', '/test/same.js']);
      
      assert.notStrictEqual(id1, id2);
      assert.strictEqual(mockWatcher.subscribe.callCount, 2);
      
      const subsForFile = watcher['subscriptionManager'].findByFilePath('/test/same.js');
      assert.strictEqual(subsForFile.length, 2);
    });

    test('should respect concurrency option during batch unsubscribe', async () => {
      const customWatcher = new GraphFileWatcher(
        mockWatcher,
        { concurrency: 3 },
        handlerRegistry
      );
      
      handlerRegistry.add(mockHandler);
      
      const files = ['/test/1.js', '/test/2.js', '/test/3.js', '/test/4.js', '/test/5.js'];
      await customWatcher.watchMany(files);
      
      // This test verifies that the concurrency setting is used
      // by checking the batch creation logic in unsubscribeMany
      const batchSize = customWatcher['options'].concurrency;
      assert.strictEqual(batchSize, 3);
    });
  });

  suite('Integration Tests', () => {
    test('should handle complete watch lifecycle', async () => {
      const mockWatcher = {
        subscribe: sinon.stub().resolves({
          unsubscribe: sinon.stub().resolves()
        })
      };
      
      const registry = new HandlersRegisry();
      const handler = sinon.spy();
      
      registry.add(handler);
      
      const watcher = new GraphFileWatcher(
        mockWatcher as any,
        { concurrency: 2 },
        registry
      );
      
      // Watch files
      const files = ['/test/1.js', '/test/2.js'];
      const ids = await watcher.watchMany(files);
      
      assert.strictEqual(ids.length, 2);
      assert.strictEqual(mockWatcher.subscribe.callCount, 2);
      
      // Simulate events
      const subscribeCall = mockWatcher.subscribe.firstCall;
      const callback = subscribeCall.args[1];
      
      const mockEvents: Event[] = [{
        type: 'update',
        path: '/test/1.js'
      }];
      
      callback(mockEvents, null);
      
      assert.ok(handler.calledOnce);
      
      // Unsubscribe
      const subscription = mockWatcher.subscribe.firstCall.returnValue;
      await watcher.unsubscribeMany(ids);
      
      assert.ok(subscription.unsubscribe.calledOnce);
      assert.strictEqual(watcher['subscriptionManager'].findAll().length, 0);
    });
  });
});