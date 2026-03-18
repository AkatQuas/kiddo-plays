export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface SessionFilter {
  search?: string;
  dateRange?: [number, number];
}
