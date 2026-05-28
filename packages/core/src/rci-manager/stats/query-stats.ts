export interface QueryStats {
  queueName: string;
  taskCount: number;
  queryCount: number;
  sentAt: number;
  durationMs: number;
  success: boolean;
  error?: unknown;
}
