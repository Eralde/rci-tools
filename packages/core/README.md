**English** | [Русский](README.ru.md)

# `@rci-tools/core`

## Overview

`@rci-tools/core` &mdash; is an `npm` package for interacting with
the [RCI API](../../docs/RCI_API.md). Two main classes exported by this package are:

- [SessionManager](./src/session-manager/session-manager.ts):
  Implements [password-based authentication](../../docs/AUTH.md).
- [RciManager](./src/rci-manager/rci.manager.ts): The main class to interact with the API in a
  uniform way.

Both classes require an [`HTTP transport` instance](./src/transport/http.transport.ts) to
send HTTP requests to the device. The package provides two browser transports:

- [`FetchTransport`](./src/transport/fetch/fetch.transport.ts) wraps the built-in `fetch` API.
- [`XHRTransport`](./src/transport/xhr/xhr.transport.ts) uses `XMLHttpRequest`.

Pass the same transport instance to both `SessionManager` and `RciManager` so that requests from
`RciManager` are sent within the authenticated HTTP session:

```typescript
import {RciManager, SessionManager, XHRTransport} from '@rci-tools/core';

const transport = new XHRTransport();
const sessionManager = new SessionManager('http://192.168.1.1', transport);
const rciManager = new RciManager('http://192.168.1.1', transport);
```

## Installation

```bash
npm install @rci-tools/core
```

## Reference

### `SessionManager`

The `SessionManager` is used to handle auth.
It has the following interface:

```typescript
interface SessionManager<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  isAuthenticated(): Observable<boolean>;
  login(username: string, password: string): Observable<boolean>;
  loginDetailed(username: string, password: string): Observable<LoginDetails>;
  logout(): Observable<unknown>;

  getRealmHeader(): Observable<string | null>;
  toggleErrorLogging(isEnabled: boolean): void;
}
```

Use `isAuthenticated`/`login`/`logout` methods for the auth session management.
Two remaining methods are:

- `getRealmHeader`: allows to get the device name before authenticating (e.g., to show it on the
  login screen)
- `toggleErrorLogging`: enables/disables logging of HTTP errors to the console

By default `SessionManager` uses the first auth protocol the device offers, preferring
`'x-ndw4-interactive'` over `'x-ndw2-interactive'`; it never falls back to another protocol after a failure.
To restrict or reorder the protocols, pass them to the constructor:

```typescript
import {AUTH_PROTOCOL, SessionManager} from '@rci-tools/core';

const sessionManager = new SessionManager('http://192.168.1.1', transport, {
  protocols: [AUTH_PROTOCOL.NDW2], // most preferred first
});
```

If the device offers none of the allowed protocols, the login fails with `'unavailable'`.

`loginDetailed` shares the same in-flight attempt with `login` (concurrent callers of either method
trigger one handshake), but emits `LoginDetails`: `{success: true, protocol}` or
`{success: false, reason, protocol}`.

`protocol` (`AUTH_PROTOCOL.*`) is the auth protocol selected from the device challenge (the `GET /auth`
reply): `'x-ndw4-interactive'` or `'x-ndw2-interactive'`. Once selected, it is reported whatever happens next,
even if the login fails before any credentials are sent. It is `null` when no protocol was selected:
the session was already there, or the reply had no usable challenge (network error, unexpected status,
none of the allowed protocols offered).

`reason` (`LOGIN_FAILURE_REASON.*`) is:

- `'rejected'`: the device refused the credentials; retrying with the same password is pointless;
- `'unavailable'`: the handshake could not be completed (the device is going down, booting, unreachable,
  or answered with something unexpected); retrying later is the right thing to do.

To bound an attempt, apply your own timeout and unsubscribe: no further handshake requests are sent,
and the next call starts a fresh handshake (the built-in transports also abort the in-flight HTTP request).

If your code re-authenticates on its own (e.g. with a stored password), keep in mind that devices have
built-in brute-force protection: too many failed logins from one client may get it temporarily blocked.
Limit the number of `'rejected'` results in a row and space out attempts after **any** failure,
not only after `'rejected'`.

### Custom HTTP transport

Implement [`HttpTransport`](./src/transport/http.transport.ts) for your response type. It requires
`get`, `post`, `delete`, `getHeader`, `onAuthRequest`, and `clearAuthData`.

Transport Observables must be cold and abort the request on unsubscribe. Any 2xx status is success;
every failed request must error with `RciHttpError`. `getHeader()` returns `null` when a header is missing.
`authError$` is optional; when provided, it emits on a 401 outside a login handshake (an expired session).
Timeouts that core adds to `execute()` and `queue()` remain RxJS `TimeoutError`, not `RciHttpError`.

Use `AuthErrorHandler` to turn `RciHttpError` responses with status 401 into `authError$` notifications.
Its RxJS operator emits when notifications are not suspended, then rethrows the same error.
`suspend()` and `resume()` maintain a nesting counter; `AuthErrorHandler.is401Error()` recognizes
`RciHttpError` by its shared brand, and `destroy()` completes `authError$`.

Expose the handler as `authErrorSuspension`. `SessionManager` calls `suspend()` during the login
handshake and `resume()` in `finalize`, so a 401 from login itself is not treated as an expired session.
The property is optional on `HttpTransport`.

```typescript
import {
  AuthErrorHandler,
  isRciHttpError,
  RciHttpError,
  RciManager,
  SessionManager,
  type AuthErrorSuspension,
  type BaseHttpResponse,
  type HttpTransport,
} from '@rci-tools/core';
import {catchError, defer, finalize, from, mergeMap, throwError, type Observable} from 'rxjs';

interface CustomResponse extends BaseHttpResponse {
  headers: Headers;
}

class CustomHttpTransport implements HttpTransport<CustomResponse> {
  private readonly authHandler = new AuthErrorHandler();
  public readonly authError$: Observable<void> = this.authHandler.authError$;
  public readonly authErrorSuspension: AuthErrorSuspension = this.authHandler;

  public get(url: string): Observable<CustomResponse> {
    return this.request(url);
  }

  public post(url: string, data: unknown): Observable<CustomResponse> {
    return this.request(url, {method: 'POST', body: JSON.stringify(data)});
  }

  public delete(url: string): Observable<CustomResponse> {
    return this.request(url, {method: 'DELETE'});
  }

  public getHeader(response: CustomResponse, name: string): string | null {
    return response.headers.get(name);
  }

  public onAuthRequest(): void {}

  public clearAuthData(): void {}

  private request(url: string, init: RequestInit = {}): Observable<CustomResponse> {
    return defer(() => {
      const controller = new AbortController();
      return from(fetch(url, {...init, signal: controller.signal})).pipe(
        catchError((cause: unknown) =>
          throwError(() => new RciHttpError<CustomResponse>('Network request failed', {status: null, cause})),
        ),
        mergeMap(async (response): Promise<CustomResponse> => {
          const result: CustomResponse = {
            status: response.status,
            headers: response.headers,
            data: {},
          };

          const body = await response.text();

          try {
            result.data = JSON.parse(body);
          } catch {
            result.data = {};
          }

          if (response.status < 200 || response.status >= 300) {
            throw new RciHttpError<CustomResponse>(`HTTP ${response.status}`, {
              status: response.status,
              response: result,
            });
          }

          return result;
        }),
        catchError((error: unknown) =>
          isRciHttpError(error)
            ? throwError(() => error)
            : throwError(() => new RciHttpError<CustomResponse>('Request failed', {status: null, cause: error})),
        ),
        finalize(() => controller.abort()),
      );
    })
      .pipe(
        this.authHandler.handleAuthError<CustomResponse>(),
      );
  }
}

const host = 'http://192.168.1.1';
const transport = new CustomHttpTransport();
const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

transport.authError$.subscribe(() => console.warn('Authentication expired'));
```

`FetchTransport`, `XHRTransport`, and `AxiosTransport` expose `authError$` publicly. They emit on 401
outside login, signaling an expired session, so application code can subscribe directly. The package
does not subscribe to `authError$`.

`RciHttpError` has `status` (`null` when there was no HTTP response), `response` (`null` when unavailable),
and `cause`. Use `isRciHttpError(error)` to recognize it: the check uses a shared `Symbol.for` brand, so it
also works when the consumer and transport load separate copies of `@rci-tools/core`; `instanceof` does not.

### `RciManager`

The `RciManager` class is used to interact with the RCI API.
It has a few advantages over just using `fetch/xhr/axios/...`:

- queries from multiple method calls can be batched into a single HTTP request
- there is a simple priority system:
  priority queries block the non-priority ones until they are finished
- it provides a convenient way to handle background processes

The `RciManager` class has the following interface:

```typescript
interface RciManager<
  QueryPath extends string = string, // valid 'path' values for regular RCI queries
  BackgroundQueryPath extends string = string // valid 'path' values for background process RCI queries
> {
  readonly stats$: Observable<QueryStats<QueryPath>>;

  toggleStats(enabled: boolean): void;
  replaceBatchScheduler(scheduler: BatchScheduler<QueryPath>, options?: {waitIdleFor?: number}): Observable<void>;

  // `T` is optional: without it, the result type comes from the queries, see "Typed queries"
  execute<T extends object>(query: RciQuery<QueryPath>): Observable<T | undefined>;
  execute<T extends object>(query: readonly RciQuery<QueryPath>[]): Observable<Array<T | undefined>>;
  queue<T extends object>(query: RciQuery<QueryPath>, options?: QueueOptions): Observable<T | undefined>;
  queue<T extends object>(query: readonly RciQuery<QueryPath>[], options?: QueueOptions): Observable<Array<T | undefined>>;
  initBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundProcessOptions): RciBackgroundProcess;
  queueBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundProcessOptions): RciBackgroundProcess;

  destroy(): void;
}
```

Additional members:

- `stats$`: emits a `QueryStats` object for each completed batch when stats collection is enabled.
  See [Query stats](./docs/QUEUE.md#query-stats).
- `toggleStats(enabled)`: enables or disables stats collection.
- `replaceBatchScheduler(scheduler, options?)`: replaces the batch scheduler at runtime,
  waiting for the current batch to become idle. `options.waitIdleFor` defaults to `30000` ms.
  Throws `SchedulerReplacementInProgressError` if another replacement is already in progress.
  See [Batch Scheduling](./docs/SCHEDULING.md).
- `destroy()`: tears down internal queues, background process queues, and the stats collector.
  Pending `queue()` results error with `QueueDestroyedError`. After `destroy()`, `execute()`, `queue()`
  and `replaceBatchScheduler()` return Observables that error with `RciManagerDestroyedError`;
  `initBackgroundProcess()` and `queueBackgroundProcess()` throw it. Processes created with
  `initBackgroundProcess()` belong to the caller and are not destroyed. The transport is not owned by
  the manager either. Calling `destroy()` again does nothing.

`T` in `execute()`/`queue()` is a type assertion, not a runtime check. An element is `undefined` when
the device response has no value at the query path.

The `RciManager` relies heavily on the [root API endpoint (`/rci/`)](../../docs/RCI_API.md#31-root-api-resource).
Interactions with both [setting](../../docs/RCI_API.md#21-settings) and
[action](../../docs/RCI_API.md#22-actions) resources can be expressed
as `RciQuery` objects send to the root API endpoint.
The `RciQuery` interface is defined as follows:

```typescript
export interface RciQuery<PathType extends string = string> { // `PathType` can be narrowed to a subset of valid path strings
  path: PathType;
  data?: Record<string, any> | string | boolean | number; // defaults to {}
  extractData?: boolean; // defaults to true
}

export type RciTask<PathType extends string = string> = RciQuery<PathType> | RciQuery<PathType>[];
```

`queue()` accepts an optional `QueueOptions` object:

```typescript
interface QueueOptions {
  isPriorityTask?: boolean;  // send through the priority queue. Default: false
  saveConfiguration?: boolean; // append a `system configuration save` query; its response is not returned. Default: false
}
```

`saveConfiguration` does not change the shape of the result: a single query emits one value, an array of N queries
emits an array of N elements. The save query is always sent last in its batch, so it also saves changes made by other
tasks in the same batch. If you need the response of the save query, add it to the array yourself, as an ordinary query
with its own result element:

```typescript
rciManager.queue([
  {path: 'system.description', data: 'Home'},
  {path: 'system.configuration.save'},
]); // emits [descriptionResult, saveResult]
```

Before being sent to the device, `RciQuery` objects are converted to
an object where the `path` becomes a property path and `data` becomes the value at that path.

For example, a query like:

```typescript
const query = {
  path: 'show.version'
};
```

is converted to (`data` defaults to an empty object):

```json
{
  "show": {
    "version": {}
  }
}
```

Similarly, a query with both path and data:

```typescript
const query = {
  path: 'interface',
  data: {
    name: 'Bridge0',
    description: 'My network'
  }
};
```

becomes:

```json
{
  "interface": {
    "name": "Bridge0",
    "description": "My network"
  }
}
```

Sending the nested object to the root API endpoint will result in getting
the response nested in the same way. If the `extractData` flag
is set to `true` (or not specified: `true` is the default value),
the `RciManager` will extract the relevant part of the response
corresponding to the original query path before returning it to you.

There is a certain flexibility in how the same object can be represented
as an `RciQuery`, for example both

```typescript
const query = {path: 'ip.telnet.session', data: {timeout: 123456}};
```

and

```typescript
const query = {path: 'ip', data: {telnet: {session: {timeout: 123456}}}};
```

will be converted to the same object inside the HTTP request payload:

```json
{
  "ip": {
    "telnet": {
      "session": {
        "timeout": 123456
      }
    }
  }
}
```

You can use the representation that is more convenient for you.

#### `execute` vs `queue`

The `RciManager` provides two methods for sending API queries:

- **`execute(query)`**: Sends the HTTP request when you subscribe to the returned Observable.
  Each subscription sends its own request; unsubscribing before the response arrives aborts it
  (built-in transports). You have full control over the subscription lifecycle. This may be useful when you need to:
    - Manually control when the HTTP request is made
    - Chain multiple queries with precise timing

- **`queue(query, options?)`**: Adds the query to an internal queue that batches multiple queries
  together.
  The `RciManager` handles the subscription internally and manages when HTTP requests are actually
  sent.
  The queue automatically:
    - Batches multiple queries into a single HTTP request
    - Removes duplicate queries from the batch
    - Waits for a configurable timeout before sending (to allow more queries to be added)
    - Handles priority queries via a separate priority queue, blocking the default one

Both methods return a [rxjs Observable](https://rxjs.dev/guide/observable)
that you must subscribe to in order to receive the result. Below are a few usage examples.
They error with `RciHttpError` for a failed request or malformed batch reply, and with RxJS `TimeoutError`
if the request does not complete within 60 seconds.

#### Typed queries

`TypedRciQuery<T>` is an `RciQuery` that carries the type of its response. `queue()` and `execute()` infer the result
type from it, so the type is declared once, next to the query, and the call needs no type argument or cast:

```typescript
import type {RciResponseOf, TypedRciQuery} from '@rci-tools/core';

interface ShowVersion {
  release: string;
  title: string;
}

interface RrdResponse {
  data?: Array<{t: number; v: number}>;
}

const SHOW_VERSION: TypedRciQuery<ShowVersion> = {path: 'show.version'};
const interfaceRrd = (name: string, attribute: string): TypedRciQuery<RrdResponse> => ({
  path: 'show.interface.rrd',
  data: {name, attribute},
});

rciManager.queue(SHOW_VERSION); // Observable<ShowVersion | undefined>
rciManager.queue([interfaceRrd('Bridge0', 'txspeed'), interfaceRrd('Bridge0', 'rxspeed')]);
// Observable<[RrdResponse | undefined, RrdResponse | undefined]>

type Version = RciResponseOf<typeof SHOW_VERSION>; // ShowVersion
```

- An array literal gives a tuple: one element per query, in the same order. A plain `RciQuery` gives
  `GenericObject | undefined` at its position. An array built at runtime (`RciQuery[]`) still gives
  `Array<GenericObject | undefined>`.
- The response type is a type assertion, like `T` in `queue<T>()`: nothing is checked at runtime. A type from the
  context (an annotation or `as`) takes precedence over the inferred one, as long as the tuple length matches the number
  of queries; a different length is a compile error.
- An explicit type argument, `queue<T>(...)`, takes precedence over the types in the queries; for an array it gives
  `Array<T | undefined>`, as before.
- With `extractData: false`, `T` describes the whole response object, not the value at the query path.
- If your `RciManager` narrows `QueryPath`, pass it as the second parameter, e.g. through a local alias:
  `type Query<T> = TypedRciQuery<T, MyQueryPath>`. `TypedRciQuery<T>` alone has `path: string`, which a narrowed
  manager rejects.
- The response type lives in an optional `'~response'` property that exists only in types. Do not set it on query
  objects.

#### Batch Scheduling

By default, `queue()` batches queries together in 20ms windows before sending a single HTTP
request. This is controlled by a **scheduler** — configure it via `RciManagerOptions.batchScheduler`
or swap it at runtime with `replaceBatchScheduler()`.

See [Batch Scheduling](./docs/SCHEDULING.md) for built-in schedulers (`TimerScheduler`,
`RuleScheduler`, `raceSchedulers`), the `BatchSnapshot` interface, custom scheduler examples, and
runtime replacement.

#### Usage Examples

##### 1. A basic example

```typescript
import {Observable, of, firstValueFrom} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
import {RciQuery, RciManager, SessionManager, FetchTransport} from '@rci-tools/core';

const transport = new FetchTransport(); // HTTP transport (wrapper over built-in `fetch`)

const host = 'http://192.168.1.1'; // device IP address
const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

// Before sending queries, you may need to authenticate:
const auth$: Observable<boolean> = sessionManager.login('admin', 'password')

auth$
  .subscribe(async (isLoggedIn) => {
    if (!isLoggedIn) {
      console.error('Authentication failed');

      return Promise.resolve(null);
    }

    // Following queries will be executed sequentially;
    // Observables returned by the `queue` method
    // are converted to Promises to make the example easier to follow.

    // setting
    const changeHomeDescription: RciQuery = {
      path: 'interface',
      data: {name: 'Bridge0', description: 'My awesome home network'},
    };

    const changeSettingResult = await firstValueFrom(rciManager.queue(changeHomeDescription)); // a generic status object

    // relevant action (setting prefixed with 'show.rc')
    const readInterfaceDescription: RciQuery = {
      path: 'show.rc.interface.description', // read from the "running-config"
      data: {name: 'Bridge0'},
    };

    const readSettingResult = await firstValueFrom(rciManager.queue(readInterfaceDescription)); // 'My awesome home network'

    // another action
    const showVersion: RciQuery = { // data will default to {}
      path: 'show.version',
    };

    const actionResult = await firstValueFrom(rciManager.queue(showVersion)); // an object containing device version info

    console.log(changeSettingResult, readSettingResult, actionResult);
  });
```

##### 2. Multiple queries

```typescript
import {forkJoin} from 'rxjs';
import {delay, exhaustMap} from 'rxjs/operators';
// other imports

// ... create an instance of `RciManager` in the same way as in the previous example ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
];

const batch1$ = rciManager.queue(queries); // Both queries will be sent in a single HTTP request

batch1$
  .pipe(
    exhaustMap((results) => {
      queries.forEach((query, index) => {
        console.log({
          query,
          result: results[index],
        });
      });

      // Those queries will also be sent in a single HTTP request
      return forkJoin([
        rciManager.queue({path: 'show.system'}),
        rciManager.queue({path: 'show.last-change'}),
        rciManager.queue({path: 'whoami'}),
      ]);
    }),
  )
  .subscribe((joinedResults) => {
    console.log(joinedResults);
  });
```

##### 3. Priority queries

If you use the batching queue, but need to send a query almost immediately,
you can send it as a priority one. Priority queries are batched within
the next event loop "tick" only. The priority queue blocks the regular
batching queue until it is empty (even if the batching one is already
waiting for a response).

```typescript
import {delay} from 'rxjs/operators';
import {forkJoin} from 'rxjs';
// other imports

// ... create an instance of `RciManager` in the same way as in the previous example ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
  {path: 'show.interface'},
];

const execute$ = rciManager.queue(queries);

// A priority query, delayed by 20 ms (data collection time for a “batch” in the default queue)
const executePriority$ = rciManager.queue({path: 'show.system'}, {isPriorityTask: true}).pipe(delay(20));

const all$ = forkJoin([
  execute$,
  executePriority$
]);

// Priority query will block the default query until it is finished.
// So, if you check how many HTTP requests were sent to the device, you'll see three requests:
//
// 1. Batch query from the first `execute` call -> cancelled by the priority query
// 2. Priority query from the second `execute` call
// 3. Batch query from the first `execute` call -> re-executed after the priority query
all$
  .subscribe((allResults) => {
    console.log(allResults);
  });
```

#### Using `RciQueue` standalone

`RciManager` wraps two `RciQueue` instances internally (a batching queue and a priority queue).
If you only need the batching behavior, you can use `RciQueue` directly — without `RciManager`.

See [Standalone `RciQueue`](./docs/QUEUE.md) for the full API, constructor options, differences
from `RciManager`, and examples including reproducing the priority system with two queues.

#### Background Processes

For [background processes](../../docs/RCI_API.md#23-background-processes),
the `RciManager` provides two methods that accept `RciQuery` objects
along with optional settings:

```typescript
interface RciBackgroundProcessOptions {
  pollInterval?: number; // ms between GET poll requests. Default: 1000
  timeout?: number;      // ms before DELETE is sent to stop the process. Default: 0 (no timeout)
}
```

The main difference between the two methods is how the background process is started:

- **`initBackgroundProcess(query, options?)`**: returns an `RciBackgroundProcess` object
  that must be started manually. This method is useful when you need full control over
  the background process lifecycle (you also can abort the ongoing process before it finishes).

- **`queueBackgroundProcess(query, options?)`**: Queues a background process. Queries with the same
  `path` are grouped into a single queue, ensuring that the same command with different arguments
  doesn't run in parallel. This is a workaround for certain API restrictions if the `RciManager`
  is used in a browser, since the browser usually uses a single HTTP session to handle all API
  requests.

Both methods return a `RciBackgroundProcess` object with:

- `start(): boolean`: Manually starts the process. Returns `false` if already running.
- `attachToRunning(): boolean`: Attaches to an already-running background process (e.g. one started
  via `RciManager.execute()`). Skips the initial POST and polls via GET immediately.
  Returns `false` if `start()` was already called, or the process is not in `INIT` state.
- `abort(): boolean`: Sends `DELETE` to the command-specific RCI resource and aborts the local process.
  A process still waiting in a `queueBackgroundProcess()` queue has not reached the device yet:
  it finishes locally with `ABORTED` (no `DELETE` is sent) and the queue skips it.
  Returns `false` in any other state.
- `state$`: Emits state changes (`RCI_BACKGROUND_PROCESS_STATE`)
- `data$`: Emits polled data updates as the background process runs
- `result$`: Emits the final payload once, right before the process completes. Does NOT emit on
  abort or timeout.
- `done$`: Emits when the process finishes, with a reason (`RCI_BACKGROUND_PROCESS_FINISH_REASON`),
  then completes
- `error: unknown`: The error that ended the process with `ERROR` (`done$` emits
  `RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR`), `null` for any other outcome or while the process is running.
  It is set before `done$` emits and stays available after `destroy()`. A failed request is a `RciHttpError`;
  `status` is `null` when there was no HTTP response. The process `timeout` option is a finish reason, not an error.
  Errors reported by the device inside a `2xx` reply (RCI `status` entries) do not end the process with `ERROR`; they
  arrive in `data$` / `result$`.
- `destroy(): void`: Releases local resources: stops polling, cancels the in-flight HTTP request,
  and completes all streams (`done$` completes without emitting). It does **not** stop the process
  on the device; call `abort()` first if you need that. A destroyed process no longer blocks its
  `queueBackgroundProcess()` queue.

```typescript
interface RciBackgroundProcess {
  state$: Observable<RCI_BACKGROUND_PROCESS_STATE>;
  data$: Observable<GenericObject | null>;
  result$: Observable<GenericObject | null>;
  done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;
  readonly error: unknown;

  start(): boolean;
  attachToRunning(): boolean;
  abort(): boolean;
  getState(): RCI_BACKGROUND_PROCESS_STATE;
  destroy(): void;
}
```

Here's a basic example using `initBackgroundProcess`:

```typescript
const pingQuery: RciQuery = {
  path: 'tools.ping',
  data: {
    host: 'google.com',
    packetsize: 84,
    count: 5,
  },
};

const ping$ = rciManager.initBackgroundProcess(pingQuery);

ping$.data$
  .subscribe((data) => {
    console.log('Ping result:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping finished:', reason);
  });

ping$.start();
```

To find out why a process failed:

```typescript
process.done$.subscribe((reason) => {
  if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR) {
    console.warn(`${process.command} failed`, process.error);
  }
});
```

You also can abort a background process manually before it finishes:

```typescript
const pingQuery: RciQuery = {
  path: 'tools.ping',
  data: {
    host: 'google.com',
    packetsize: 84,
    count: 50,
  },
};

const ping$ = rciManager.initBackgroundProcess(pingQuery);

ping$.data$
  .subscribe((data) => {
    console.log('Ping result:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping finished:', reason);
  });

ping$.start();

setTimeout(() => ping$.abort(), 4000);
```

If a background process was already started externally (e.g. via `RciManager.execute()`),
you can attach to it with `attachToRunning()` to poll for results without sending a new POST:

```typescript
import {RciManager, RciQuery} from '@rci-tools/core';

const host = 'http://192.168.1.1';
const transport = new FetchTransport();
const rciManager = new RciManager(host, transport);

// Step 1: start the background process via a regular API call
const startFwCheckQuery: RciQuery = {
  path: 'components.list',
  data: {},
};

await firstValueFrom(rciManager.execute(startFwCheckQuery));
// Device responds with {continued: true} — process is running

// Step 2: create a background process instance and attach to it
const pollProcess = rciManager.initBackgroundProcess(
  {path: 'components.list'},
  {pollInterval: 1000, timeout: 30000},
);

pollProcess.result$
  .subscribe((result) => {
    console.log('Firmware update check complete:', result);
  });

pollProcess.attachToRunning(); // polls via GET, no POST sent
```

For managing multiple background processes with the same command but different arguments,
use `queueBackgroundProcess` to ensure they don't run in parallel:

```typescript
import {forkJoin, firstValueFrom} from 'rxjs';

// Multiple background processes with the same path but different data
const continuedQueries: RciQuery[] = [
  {path: 'tools.ping', data: {host: 'google.com', packetsize: 84, count: 5}},
  {path: 'tools.ping', data: {host: 'github.com', packetsize: 84, count: 5}},
  {path: 'components.list', data: {sandbox: 'stable'}},
  {path: 'components.list', data: {sandbox: 'draft'}},
];

// Queue all processes - queries with the same path will be queued together
const backgroundTasks = continuedQueries.map((query) => {
  return rciManager.queueBackgroundProcess(query);
});

// Monitor completion of all tasks
const done$ = backgroundTasks.map((task) => task.done$);
const finalResults = await firstValueFrom(forkJoin(done$));

console.log('All background processes finished:', finalResults);
```

In this example, the two `tools.ping` queries will be queued together (executed sequentially),
and the two `components.list` queries will also be queued together, preventing conflicts
from running the same command with different arguments simultaneously.

#### Query stats

When enabled via `toggleStats(true)`, `stats$` emits a `QueryStats` object for each completed
batch. See [Query stats](./docs/QUEUE.md#query-stats) for the full `QueryStats` interface and
usage with standalone `RciQueue`.
