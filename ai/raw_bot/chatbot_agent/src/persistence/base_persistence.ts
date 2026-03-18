// Universal persistence interface
export interface Persistence<T> {
  // Incremental write (avoid full overwrites)
  write(key: string, data: Partial<T>): Promise<void>;
  // Sharded read (avoid loading large datasets at once)
  read(key: string, page?: number, pageSize?: number): Promise<T | T[] | null>;
  // Delete
  delete(key: string): Promise<void>;
  // Batch operations (reserved)
  batch(
    operations: Array<{ type: 'write' | 'delete'; key: string; data?: any }>
  ): Promise<void>;
}
