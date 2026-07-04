export interface RciError {
  error?: string;
  code: string;
  message: string;
}

export interface RciStatusObject {
  status?: string;
  code?: string;

  [key: string]: unknown;

  path?: string[];
}

export type RciStatusList = RciStatusObject[];
