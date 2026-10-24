import {describe, expect, it} from 'vitest';
import * as core from '../../src';

// Runtime half of the public API contract; types are covered by `public-api.test-d.ts`.
// A symbol is public when README (or a doc it links to) mentions it, a consumer imports it,
// or it appears in the signature of another public symbol.
const PUBLIC_VALUES = [
  'AUTH_PROTOCOL',
  'AuthErrorHandler',
  'FetchTransport',
  'LOGIN_FAILURE_REASON',
  'QueryStatsCollector',
  'RciHttpError',
  'QueueDestroyedError',
  'QueueNotIdleError',
  'RCI_BACKGROUND_PROCESS_FINISH_REASON',
  'RCI_BACKGROUND_PROCESS_STATE',
  'RCI_QUEUE_STATE',
  'RciBackgroundProcess',
  'RciManager',
  'RciManagerDestroyedError',
  'RciQueue',
  'RciResponseHelper',
  'RuleScheduler',
  'SchedulerReplacementInProgressError',
  'SessionManager',
  'TimerScheduler',
  'XHRHeaders',
  'XHRTransport',
  'after',
  'pathIncluded',
  'queryCountAtLeast',
  'raceSchedulers',
  'when',
  'isRciHttpError',
];

describe('public API', () => {
  it('exports exactly the public runtime values', () => {
    expect(Object.keys(core).sort()).toEqual([...PUBLIC_VALUES].sort());
  });
});
