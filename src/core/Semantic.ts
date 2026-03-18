import { ChromaClient, type Collection } from "chromadb";
import type { ISemanticIndexState, SemanticSearchResult } from "../contract/State/Semantic.js";
import type { SemanticNode } from "../contract/Graph.js";

/**
 * Semantic index state using in-memory ChromaDB
 */
export class SemanticIndexState implements ISemanticIndexState {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName = "semantic_nodes";

  constructor() {
    this.client = new ChromaClient();
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.collection = await this.client.createCollection({ 
        name: this.collectionName 
      });
    } catch {
      try {
        this.collection = await this.client.getCollection({ 
          name: this.collectionName 
        });
      } catch {
        // Silently fail, collection will be null
      }
    }
  }

  private async ensureCollection(): Promise<Collection | null> {
    if (!this.collection) {
      await this.init();
    }
    return this.collection;
  }

 async search(query: string, limit: number = 10): Promise<SemanticSearchResult> {
    const collection = await this.ensureCollection();
    if (!collection) return {
      matches: [],
      score:0,
    };
    
    try {
      const results = await collection.query({
        queryTexts: [query],
        nResults: limit
      });

      const searchResults: SemanticSearchResult[] = [];
      
      return {
        matches: results,
        score: results.distances[0] as unknown as number,
      }
      
    } catch {
      return {
        matches: [],
        score: 0,
      };
    }
  }

  async addNode(nodeId: string, embedding: number[]): Promise<void> {
    const collection = await this.ensureCollection();
    if (!collection) return;
    
    try {
      await collection.add({
        ids: [nodeId],
        embeddings: [embedding],
        metadatas: [{
          added: Date.now()
        }]
      });
    } catch {
      // Silently fail
    }
  }

  async removeNode(nodeId: string): Promise<void> {
    const collection = await this.ensureCollection();
    if (!collection) return;
    
    try {
      await collection.delete({
        ids: [nodeId]
      });
    } catch {
      // Silently fail
    }
  }

  async rebuild(nodes: SemanticNode[]): Promise<void> {
    try {
      // Delete existing collection
      try {
        await this.client.deleteCollection({ name: this.collectionName });
      } catch {
        // Ignore if doesn't exist
      }
      
      // Create new collection
      this.collection = await this.client.createCollection({ 
        name: this.collectionName 
      });
      
      if (nodes.length > 0) {
        // Create simple document strings from nodes
        const documents = nodes.map(node => 
          `${node.name} ${node.intent} ${node.metadata?.type || ''}`
        );
        
        await this.collection.add({
          ids: nodes.map(n => n.id),
          documents: documents,
          metadatas: nodes.map(n => ({
            name: n.name,
            type: n.metadata?.type,
            intent: n.intent
          }))
        });
      }
    } catch {
      this.collection = null;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = null;
    } catch {
      this.collection = null;
    }
  }
}