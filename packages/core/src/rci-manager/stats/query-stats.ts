export interface QueryStats<QueryPath extends string = string> {
  readonly queueName: string;
  readonly taskCount: number;
  readonly queryCount: number;
  readonly queryPaths: readonly QueryPath[];
  readonly sentAt: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: unknown;
}
