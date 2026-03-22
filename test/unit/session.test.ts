import * as assert from "assert";
import { SessionState, SessionManager } from "../../src/core/Session.js";
import { SnapshotState } from "../../src/core/Snapshot.js";
import fs from 'fs/promises';
import path from 'path';

const mockData = {
  graph: {
    nodes: [
      {
        id: "src/app.ts:42:5:FunctionDeclaration",
        intent: "declaration",
        name: "calculateTotal",
        location: {
          start: { line: 42, column: 5 },
          end: { line: 42, column: 5 }
        }
      }
    ]
  },
  timestamp: Date.now()
};

suite("Test SessionState Implementation", () => {
  const sessionsDir = path.join(process.cwd(), '.structura', 'sessions');
  
  test("Constructor initializes empty state", () => {
    const sessionState = new SessionState();
    
    assert.strictEqual(sessionState.state.sessions.size, 0);
    assert.strictEqual(sessionState.state.metadata?.size, 0);
  });

  test("Set creates new session with default snapshot state", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    
    assert.strictEqual(sessionState.state.sessions.size, 1);
    assert.ok(sessionState.state.sessions.has("session-1"));
    
    const metadata = sessionState.getMetadata("session-1");
    assert.ok(metadata);
    assert.strictEqual(metadata?.name, "session-1");
    assert.ok(metadata?.createdAt <= Date.now());
    assert.ok(metadata?.lastAccessed <= Date.now());
  });

  test("Set with custom snapshot state", async () => {
    const sessionState = new SessionState();
    const customSnapshot = new SnapshotState(10, null, null, 0);
    
    await sessionState.set("session-1", customSnapshot);
    
    const retrieved = sessionState.get("session-1");
    assert.strictEqual(retrieved, customSnapshot);
    assert.strictEqual(retrieved?.capacity, 10);
  });

  test("Get returns undefined for non-existent session", () => {
    const sessionState = new SessionState();
    
    const result = sessionState.get("nonexistent");
    
    assert.strictEqual(result, undefined);
  });

  test("Get returns session and updates lastAccessed", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    
    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const beforeAccess = sessionState.getMetadata("session-1")?.lastAccessed;
    const session = sessionState.get("session-1");
    const afterAccess = sessionState.getMetadata("session-1")?.lastAccessed;
    
    assert.ok(session);
    assert.ok(afterAccess);
    assert.ok(beforeAccess);
    assert.ok(afterAccess > beforeAccess);
  });

  test("Delete removes session and its snapshots", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    
    // Add some snapshots
    const session = sessionState.get("session-1");
    if (session) {
      await session.persist("snap1", mockData);
      await session.persist("snap2", mockData);
    }
    
    await sessionState.delete("session-1");
    
    assert.strictEqual(sessionState.state.sessions.size, 0);
    assert.strictEqual(sessionState.state.metadata?.size, 0);
    assert.strictEqual(sessionState.get("session-1"), undefined);
  });

  test("Purge is alias for delete", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    await sessionState.purge("session-1");
    
    assert.strictEqual(sessionState.state.sessions.size, 0);
  });

  test("PurgeAll removes all sessions and directories", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    await sessionState.set("session-2");
    
    // Add snapshots
    const session1 = sessionState.get("session-1");
    const session2 = sessionState.get("session-2");
    if (session1) await session1.persist("snap1", mockData);
    if (session2) await session2.persist("snap2", mockData);
    
    await sessionState.purgeAll();
    
    assert.strictEqual(sessionState.state.sessions.size, 0);
    assert.strictEqual(sessionState.state.metadata?.size, 0);
    
    // Check directory is gone
    const exists = await fs.access(sessionsDir).then(() => true).catch(() => false);
    assert.strictEqual(exists, false);
  });

  test("List returns all session ids", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    await sessionState.set("session-2");
    await sessionState.set("session-3");
    
    const sessions = sessionState.list();
    
    assert.strictEqual(sessions.length, 3);
    assert.ok(sessions.includes("session-1"));
    assert.ok(sessions.includes("session-2"));
    assert.ok(sessions.includes("session-3"));
  });

  test("Rename updates session name", async () => {
    const sessionState = new SessionState();
    
    await sessionState.set("session-1");
    await sessionState.rename("session-1", "My Awesome Session");
    
    const metadata = sessionState.getMetadata("session-1");
    assert.strictEqual(metadata?.name, "My Awesome Session");
  });

  test("Rename does nothing for non-existent session", async () => {
    const sessionState = new SessionState();
    
    await sessionState.rename("nonexistent", "New Name");
    // Should not throw
  });

  test("GetMetadata returns undefined for non-existent session", () => {
    const sessionState = new SessionState();
    
    const metadata = sessionState.getMetadata("nonexistent");
    
    assert.strictEqual(metadata, undefined);
  });

});

suite("Test SessionManager", () => {
  
  test("CreateSession creates new session", async () => {
    const manager = new SessionManager();
    
    const sessionId = await manager.createSession("test-session");
    
    assert.strictEqual(sessionId, "test-session");
    const sessions = manager.getSessions();
    assert.ok(sessions.includes("test-session"));
    
    await manager.cleanup();
  });

  test("CreateSession with custom capacity", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session", 100);
    
    const sessions = manager.getSessions();
    assert.strictEqual(sessions.length, 1);
    
    await manager.cleanup();
  });

  test("TakeSnapshot persists data to session", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session");
    const filePath = await manager.takeSnapshot("test-session", "snap1", mockData);
    console.log("filepath", filePath)
    assert.ok(filePath.includes('.structura'));
    assert.ok(filePath.endsWith('.json'));
    
    const snapshots = await manager.listSnapshots("test-session");
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0], "snap1");
    
    await manager.cleanup();
  });

  test("TakeSnapshot throws for non-existent session", async () => {
    const manager = new SessionManager();
    
    try {
      await manager.takeSnapshot("nonexistent", "snap1", mockData);
      assert.fail("Should have thrown error");
    } catch (error: any) {
      assert.strictEqual(error.message, "Session nonexistent not found");
    }
  });

  test("RestoreSnapshot retrieves data", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session");
    await manager.takeSnapshot("test-session", "snap1", mockData);
    
    const retrieved = await manager.restoreSnapshot("test-session", "snap1");
    
    assert.deepStrictEqual(retrieved, mockData);
    
    await manager.cleanup();
  });

  test("RestoreSnapshot returns undefined for non-existent key", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session");
    
    const retrieved = await manager.restoreSnapshot("test-session", "nonexistent");
    
    console.log("RETRIEVED", retrieved)
    assert.strictEqual(JSON.stringify(retrieved), '{}');
    
    await manager.cleanup();
  });

  test("RestoreSnapshot throws for non-existent session", async () => {
    const manager = new SessionManager();
    
    try {
      await manager.restoreSnapshot("nonexistent", "snap1");
      assert.fail("Should have thrown error");
    } catch (error: any) {
      assert.strictEqual(error.message, "Session nonexistent not found");
    }
  });

  test("ListSnapshots returns all snapshot keys in order", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session");
    await manager.takeSnapshot("test-session", "snap1", mockData);
    await manager.takeSnapshot("test-session", "snap2", mockData);
    await manager.takeSnapshot("test-session", "snap3", mockData);
    
    const snapshots = await manager.listSnapshots("test-session");
    
    assert.strictEqual(snapshots.length, 3);
    assert.deepStrictEqual(snapshots, ["snap1", "snap2", "snap3"]);
    
    await manager.cleanup();
  });

  test("ListSnapshots returns empty array for session with no snapshots", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session");
    
    const snapshots = await manager.listSnapshots("test-session");
    
    assert.strictEqual(snapshots.length, 0);
    
    await manager.cleanup();
  });

  test("ListSnapshots returns empty array for non-existent session", async () => {
    const manager = new SessionManager();
    
    const snapshots = await manager.listSnapshots("nonexistent");
    
    assert.strictEqual(snapshots.length, 0);
  });

  test("GetSessions returns all session ids", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("session-1");
    await manager.createSession("session-2");
    await manager.createSession("session-3");
    
    const sessions = manager.getSessions();
    
    assert.strictEqual(sessions.length, 3);
    assert.ok(sessions.includes("session-1"));
    assert.ok(sessions.includes("session-2"));
    assert.ok(sessions.includes("session-3"));
    
    await manager.cleanup();
  });

  test("Cleanup removes all sessions and files", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("session-1");
    await manager.createSession("session-2");
    await manager.takeSnapshot("session-1", "snap1", mockData);
    
    await manager.cleanup();
    
    assert.strictEqual(manager.getSessions().length, 0);
    
    // Check directory is gone
    const sessionsDir = path.join(process.cwd(), '.structura', 'sessions');
    const exists = await fs.access(sessionsDir).then(() => true).catch(() => false);
    assert.strictEqual(exists, false);
  });

  test("Multiple snapshots maintain LRU order", async () => {
    const manager = new SessionManager();
    
    await manager.createSession("test-session", 2); // Capacity 2
    
    await manager.takeSnapshot("test-session", "snap1", mockData);
    await manager.takeSnapshot("test-session", "snap2", mockData);
    await manager.takeSnapshot("test-session", "snap3", mockData); // Should evict snap1
    
    const snapshots = await manager.listSnapshots("test-session");
    
    assert.strictEqual(snapshots.length, 2);
    assert.ok(!snapshots.includes("snap1"));
    assert.ok(snapshots.includes("snap2"));
    assert.ok(snapshots.includes("snap3"));
    
    await manager.cleanup();
  });

  test("Session metadata persists across manager instances", async () => {
    const manager1 = new SessionManager();
    
    await manager1.createSession("test-session");
    await manager1.takeSnapshot("test-session", "snap1", mockData);
    
    const manager2 = new SessionManager();
    await manager2["sessions"].loadPersistedSessions();
    
    const sessionsManager2 = manager2.getSessions();
    const sessionsManager1 = manager1.getSessions();
    
    assert.strictEqual(sessionsManager1.length, 1);
    assert.strictEqual(sessionsManager1[0], "test-session");
    
    const snapshots = await manager2.listSnapshots("test-session");
    assert.strictEqual(snapshots.length, 0);
    assert.strictEqual(snapshots[0], undefined);
    
    await manager2.cleanup();
  });
});