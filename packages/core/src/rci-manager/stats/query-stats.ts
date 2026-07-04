export interface QueryStats<QueryPath extends string = string> {
  queueName: string;
  taskCount: number;
  queryCount: number;
  queryPaths: readonly QueryPath[];
  sentAt: number;
  durationMs: number;
  success: boolean;
  error?: unknown;
}
