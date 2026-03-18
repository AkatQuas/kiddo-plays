import type { Persistence } from './base_persistence';
import { serializer } from './serializer';

export class LocalStoragePersistence<T> implements Persistence<T> {
  async write(key: string, data: Partial<T>): Promise<void> {
    try {
      const existingData = await this.read(key);
      const newData = existingData ? { ...existingData, ...data } : data;
      localStorage.setItem(key, serializer.serialize(newData));
    } catch (error) {
      console.error('LocalStorage write error:', error);
      throw error;
    }
  }

  async read<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return serializer.deserialize<T>(raw);
    } catch (error) {
      console.error('LocalStorage read error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('LocalStorage delete error:', error);
      throw error;
    }
  }

  async batch(
    operations: Array<{ type: 'write' | 'delete'; key: string; data?: any }>
  ): Promise<void> {
    try {
      operations.forEach((op) => {
        if (op.type === 'write' && op.data) {
          localStorage.setItem(op.key, serializer.serialize(op.data));
        } else if (op.type === 'delete') {
          localStorage.removeItem(op.key);
        }
      });
    } catch (error) {
      console.error('LocalStorage batch error:', error);
      throw error;
    }
  }
}

// Create singleton instances for common use cases
export const localStoragePersistence = new LocalStoragePersistence();
export const configPersistence = new LocalStoragePersistence();
export const sessionMetaPersistence = new LocalStoragePersistence();
