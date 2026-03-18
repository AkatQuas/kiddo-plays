import type { Persistence } from './base_persistence';

export class IndexedDBPersistence<T> implements Persistence<T> {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName: string;

  constructor(dbName = 'chatbotAgent', storeName = 'dataStore') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        reject(
          new Error(
            `IndexedDB initialization error: ${(event.target as IDBOpenDBRequest).error}`
          )
        );
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  async write(key: string, data: Partial<T>): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      const existingData = await new Promise<T | null>((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
      });

      const newData = existingData ? { ...existingData, ...data } : data;
      store.put(newData, key);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error('IndexedDB write error:', error);
      throw error;
    }
  }

  async read(key: string, page = 1, pageSize = 20): Promise<T | T[] | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);

      // If key is a special "list" key, return paginated results
      if (key === '__LIST__') {
        return new Promise((resolve) => {
          const results: T[] = [];
          const cursor = store.openCursor();
          let count = 0;
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;

          cursor.onsuccess = (event) => {
            const cursor = (event.target as unknown as IDBCursorWithValue)
              .result;
            if (cursor) {
              if (count >= startIndex && count < endIndex) {
                results.push(cursor.value);
              }
              count++;
              if (count < endIndex) {
                cursor.continue();
              } else {
                resolve(results);
              }
            } else {
              resolve(results);
            }
          };
        });
      }

      // Single item read
      return new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
      });
    } catch (error) {
      console.error('IndexedDB read error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      store.delete(key);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
      throw error;
    }
  }

  async batch(
    operations: Array<{ type: 'write' | 'delete'; key: string; data?: any }>
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      operations.forEach((op) => {
        if (op.type === 'write' && op.data) {
          store.put(op.data, op.key);
        } else if (op.type === 'delete') {
          store.delete(op.key);
        }
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error('IndexedDB batch error:', error);
      throw error;
    }
  }
}

// Create singleton instance for message storage
export const indexedDBPersistence = new IndexedDBPersistence();
