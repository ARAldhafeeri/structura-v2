import type { IStracturaSessionState, ISessionState, SessionMetadata } from "../contract/State/Session.js";
import type { IStracturaSnapshotState } from "../contract/State/Snapshot.js";
import { SnapshotState } from "./Snapshot.js";
import fs from 'fs/promises';
import path from 'path';

/**
 * Session management implementation
 */
export class SessionState implements ISessionState {
  public state: IStracturaSessionState;
  private sessionsDir: string;
  private metadataFile: string;

  constructor() {
    this.state = {
      sessions: new Map<string, IStracturaSnapshotState>(),
      metadata: new Map<string, SessionMetadata>()
    };
    this.sessionsDir = path.join(process.cwd(), '.structura', 'sessions');
    this.metadataFile = path.join(this.sessionsDir, 'metadata.json');
  }

  async set(sessionId: string, history?: IStracturaSnapshotState): Promise<void> {
    // Create sessions directory if it doesn't exist
    await fs.mkdir(this.sessionsDir, { recursive: true });

    // Create new snapshot state if not provided
    const snapshotState = history || new SnapshotState(50, null, null, 0);
    
    // Store in memory
    this.state.sessions.set(sessionId, snapshotState);

    // Update metadata
    const now = Date.now();
    const existingMetadata = this.state.metadata?.get(sessionId);
    this.state.metadata?.set(sessionId, {
      name: existingMetadata?.name || sessionId,
      createdAt: existingMetadata?.createdAt || now,
      lastAccessed: now,
      description: existingMetadata?.description,
      tags: existingMetadata?.tags
    });

    // Persist metadata
    await this.persistMetadata();
  }

  get(sessionId: string): IStracturaSnapshotState | undefined {
    const session = this.state.sessions.get(sessionId);
    
    if (session) {
      // Update last accessed time
      const metadata = this.state.metadata?.get(sessionId);
      if (metadata) {
        metadata.lastAccessed = Date.now();
        this.persistMetadata().catch(console.error);
      }
    }
    
    return session;
  }

  async delete(sessionId: string): Promise<void> {
    const snapshotState = this.state.sessions.get(sessionId);
    
    // Clear all persisted snapshots for this session
    if (snapshotState) {
      await snapshotState.clear();
    }
    
    // Remove from memory
    this.state.sessions.delete(sessionId);
    this.state.metadata?.delete(sessionId);
    
    // Update metadata
    await this.persistMetadata();
  }

  async purge(sessionId: string): Promise<void> {
    // Same as delete since clear() already handles file cleanup
    await this.delete(sessionId);
  }

  async purgeAll(): Promise<void> {
    // Clear all sessions
    for (const [sessionId, snapshotState] of this.state.sessions) {
      await snapshotState.clear();
    }
    
    // Clear maps
    this.state.sessions.clear();
    this.state.metadata?.clear();
    
    // Remove sessions directory
    try {
      await fs.rm(this.sessionsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }

  list(): string[] {
    return Array.from(this.state.sessions.keys());
  }

  async rename(sessionId: string, name: string): Promise<void> {
    const metadata = this.state.metadata?.get(sessionId);
    if (metadata) {
      metadata.name = name;
      await this.persistMetadata();
    }
  }

  getMetadata(sessionId: string): SessionMetadata | undefined {
    return this.state.metadata?.get(sessionId);
  }

  async loadPersistedSessions(): Promise<void> {
    try {
      // Load metadata
      const metadataContent = await fs.readFile(this.metadataFile, 'utf-8');
      const parsed = JSON.parse(metadataContent);
      
      if (parsed.metadata) {
        this.state.metadata = new Map(Object.entries(parsed.metadata));
      }
      
      // Rehydrate sessions from disk
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(f => f.endsWith('.json') && f !== 'metadata.json');
      
      for (const file of sessionFiles) {
        const sessionId = file.replace('.json', '');
        
        // Create snapshot state with capacity 50
        const snapshotState = new SnapshotState(50, null, null, 0);
        
        // Load snapshots from session directory
        const sessionSnapDir = path.join(this.sessionsDir, sessionId);
        try {
          const snapFiles = await fs.readdir(sessionSnapDir);
          for (const snapFile of snapFiles) {
            if (snapFile.endsWith('.json')) {
              const snapPath = path.join(sessionSnapDir, snapFile);
              const content = await fs.readFile(snapPath, 'utf-8');
              const data = JSON.parse(content);
              
              // Extract key from filename or content
              const key = snapFile.replace('.json', '');
              snapshotState.add(key, snapPath);
            }
          }
        } catch (error) {
          // No snapshots for this session yet
        }
        
        this.state.sessions.set(sessionId, snapshotState);
      }
    } catch (error) {
      // No persisted sessions yet
    }
  }

  private async persistMetadata(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    
    const metadataObj: Record<string, SessionMetadata> = {};
    if (this.state.metadata) {
      for (const [key, value] of this.state.metadata) {
        metadataObj[key] = value;
      }
    }
    
    await fs.writeFile(this.metadataFile, JSON.stringify({
      metadata: metadataObj,
      lastUpdated: Date.now()
    }, null, 2));
  }
}

/**
 * Example usage and test helper
 */
export class SessionManager {
  private sessions: SessionState;

  constructor() {
    this.sessions = new SessionState();
  }

  async createSession(sessionId: string, capacity: number = 50): Promise<string> {
    const snapshotState = new SnapshotState(capacity, null, null, 0);
    await this.sessions.set(sessionId, snapshotState);
    return sessionId;
  }

  async takeSnapshot(sessionId: string, key: string, data: any): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return await session.persist(key, data);
  }

  async restoreSnapshot(sessionId: string, key: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return await session.getSnapshot(key);
  }

  async listSnapshots(sessionId: string): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    
    const snapshots: string[] = [];
    let curr = session.head;
    while (curr) {
      snapshots.push(curr.key);
      curr = curr.next;
    }
    return snapshots;
  }

  getSessions(): string[] {
    return this.sessions.list();
  }

  async cleanup(): Promise<void> {
    await this.sessions.purgeAll();
  }
}