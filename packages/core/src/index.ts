// Public API of `@rci-tools/core`: everything exported here is supported; anything else is internal.
// Keep in sync with `__tests__/unit/public-api.test.ts` and `__tests__/unit/public-api.test-d.ts`.

// Manager
export { RciManager, RciManagerDestroyedError, SchedulerReplacementInProgressError } from './rci-manager/rci.manager';
export type { QueueOptions, RciManagerOptions } from './rci-manager/rci.manager.types';

// Queries
export type {
  QueryData,
  RciQuery,
  RciResponseOf,
  RciResultsOf,
  RciTask,
  TypedRciQuery,
} from './rci-manager/query/rci.query';
export type { GenericObject, TaskResult } from './type.utils';

// Response helpers
export { RciResponseHelper } from './rci-manager/helpers/rci-response.helper';
export type { RciError, RciStatusList, RciStatusObject } from './rci-manager/helpers/rci-response.types';

// Queue
export { RciQueue } from './rci-manager/queue/rci.queue';
export { RCI_QUEUE_STATE } from './rci-manager/queue/rci.queue.types';
export type { RciQueueOptions, RciQueueState } from './rci-manager/queue/rci.queue.types';
export { QueueDestroyedError } from './rci-manager/queue/queue-destroyed.error';
export { QueueNotIdleError } from './rci-manager/queue/queue-not-idle.error';

// Batch schedulers
export { TimerScheduler } from './rci-manager/scheduler/timer-scheduler';
export { after, pathIncluded, queryCountAtLeast, RuleScheduler, when } from './rci-manager/scheduler/rule-scheduler';
export type { BatchRule } from './rci-manager/scheduler/rule-scheduler';
export { raceSchedulers } from './rci-manager/scheduler/race-schedulers';
export type { BatchScheduler, BatchSnapshot } from './rci-manager/scheduler/scheduler.types';

// Query stats
export { QueryStatsCollector } from './rci-manager/stats/query-stats-collector';
export type { QueryStats } from './rci-manager/stats/query-stats';

// Background processes
export {
  RCI_BACKGROUND_PROCESS_FINISH_REASON,
  RCI_BACKGROUND_PROCESS_STATE,
  RciBackgroundProcess,
} from './rci-manager/background-process/rci.background-process';
export type { RciBackgroundProcessOptions } from './rci-manager/background-process/rci.background-process';

// Session
export { SessionManager } from './session-manager/session-manager';
export type { LoginDetails, SessionManagerOptions } from './session-manager/session-manager.types';
export { AUTH_PROTOCOL, LOGIN_FAILURE_REASON } from './session-manager/auth-protocol/auth-protocol.types';
export type {
  AuthProtocolName,
  LoginFailureReason,
  LoginResult,
  SessionAuthContext,
  SessionAuthProtocol,
} from './session-manager/auth-protocol/auth-protocol.types';

// Transport
export type { AuthErrorSuspension, BaseHttpResponse, HttpTransport } from './transport/http.transport';
export { AuthErrorHandler } from './transport/errors/auth-error-handler';
export { FetchTransport } from './transport/fetch/fetch.transport';
export type { FetchTransportResponse } from './transport/fetch/fetch.transport';
export { XHRHeaders, XHRTransport } from './transport/xhr/xhr.transport';
export type { XHRTransportResponse } from './transport/xhr/xhr.transport';
