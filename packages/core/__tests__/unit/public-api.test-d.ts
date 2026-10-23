// Type half of the public API contract; runtime values are covered by `public-api.test.ts`.
// Removing any of these types from the package root breaks `pnpm test:types`.
import type {
  AuthErrorSuspension,
  AuthProtocolName,
  BaseHttpResponse,
  BatchRule,
  BatchScheduler,
  BatchSnapshot,
  FetchTransportResponse,
  GenericObject,
  HttpTransport,
  LoginDetails,
  LoginFailureReason,
  LoginResult,
  QueryData,
  QueryStats,
  QueueOptions,
  RciBackgroundProcessOptions,
  RciError,
  RciManagerOptions,
  RciQuery,
  RciQueueOptions,
  RciQueueState,
  RciResponseOf,
  RciResultsOf,
  RciStatusList,
  RciStatusObject,
  RciTask,
  SessionAuthContext,
  SessionAuthProtocol,
  SessionManagerOptions,
  TaskResult,
  TypedRciQuery,
  XHRTransportResponse,
} from '../../src';

// Internal types must not be reachable from the package root.
// @ts-expect-error internal
import type {ObjectOrArray} from '../../src';
// @ts-expect-error internal
import type {QueueTask} from '../../src';
// @ts-expect-error internal
import type {RciBackgroundTaskQueueState} from '../../src';
// @ts-expect-error internal
import type {Values} from '../../src';

export type PublicTypes = [
  AuthErrorSuspension,
  AuthProtocolName,
  BaseHttpResponse,
  BatchRule,
  BatchScheduler,
  BatchSnapshot,
  FetchTransportResponse,
  GenericObject,
  HttpTransport,
  LoginDetails,
  LoginFailureReason,
  LoginResult,
  QueryData,
  QueryStats,
  QueueOptions,
  RciBackgroundProcessOptions,
  RciError,
  RciManagerOptions,
  RciQuery,
  RciQueueOptions<BaseHttpResponse>,
  RciQueueState,
  RciResponseOf<RciQuery>,
  RciResultsOf<[]>,
  RciStatusList,
  RciStatusObject,
  RciTask,
  SessionAuthContext,
  SessionAuthProtocol,
  SessionManagerOptions,
  TaskResult,
  TypedRciQuery<object>,
  XHRTransportResponse,
];

export type InternalTypes = [ObjectOrArray, QueueTask, RciBackgroundTaskQueueState, Values<{}>];
