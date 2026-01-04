export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface RciResponse {
  [key: string]: unknown;
  error?: unknown;
  status?: unknown;
  body?: unknown;
}
