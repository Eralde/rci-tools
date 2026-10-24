export enum LOG_ITEM_LEVEL {
  INFO = 'Info',
  WARNING = 'Warning',
  ERROR = 'Error',
  CRITICAL = 'Critical',
  DEBUG = 'Debug',
}

export type LOG_ITEM_LABEL = 'I' | 'W' | 'E' | 'C' | '—';

export interface LogItem {
  message: {
    // the device may report levels missing from `LOG_ITEM_LEVEL`
    level: LOG_ITEM_LEVEL | string;
    label: LOG_ITEM_LABEL | string;
    message: string;
  };
  // RFC 3164 timestamp, e.g.: 'May 24 18:14:53'
  // @see https://tools.ietf.org/html/rfc3164#section-4.1.2
  timestamp: string;
  ident: string;
  id: number;
}

export interface ShowLogResponse {
  log?: {[index: string]: LogItem};
  continued?: boolean;
}
