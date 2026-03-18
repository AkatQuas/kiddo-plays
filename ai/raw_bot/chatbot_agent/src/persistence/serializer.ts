export const serializer = {
  serialize: <T>(data: T): string => {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.error('Serialization error:', error);
      return '';
    }
  },

  deserialize: <T>(data: string): T | null => {
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Deserialization error:', error);
      return null;
    }
  }
};
