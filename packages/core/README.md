# `@rci-tools/core`

## Overview

TypeScript library for interacting with the [RCI API](../../docs/RCI_API.md).
Two main classes exported by this package are:

- [SessionManager](./src/session-manager/session-manager.ts): Handles authentication on the device.
- [RciManager](./src/rci-manager/rci.manager.ts): The main class to interact with the API.

The `SessionManager` implements [password-based authentication](../../docs/AUTH.md).

The `RciManager` is responsible for actual device configuration/monitoring.
It has a few advantages over just using `fetch/xhr/axios/...`:
- multiple separate commands/requests can be batched into a single HTTP request
  (+ duplicates are removed from the batch that is sent to the device)
- there is a simple priority system:
  priority commands block sending the non-priority ones until they are done
- the `RciManager` provides a way to work with the background processes
  that avoids running same command with different arguments in parallel

Both classes require a [`HTTP transport` instance](./src/transport/http.transport.ts) to
send HTTP requests to the device. The `@rci-tools/core` module providers
[a wrapper over `fetch`](./src/transport/fetch/fetch.transport.ts) for that.
Pass the same instance of `FetchTransport` to both `SessionManager` and `RciManager`
so that requests from `RciManager` are sent within an authorized HTTP session.

## Installation

```bash
npm install @rci-tools/core
```

## Reference

### `SessionManager`

The `SessionManager` class has the following interface:

```typescript
interface SessionManager<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  isAuthenticated(): Observable<boolean>;
  login(username: string, password: string): Observable<boolean>;
  logout(): Observable<unknown>;

  getRealmHeader(): Observable<string>;
  toggleErrorLogging(isEnabled: boolean): void;
}
```

It is pretty straightforward -- use `login`/`logout`/`isAuthenticated` for the auth session management.
Two remaining methods are:
- `getRealmHeader`: can be used to get the device name without authenticating (e.g., to show it on the login screen)
- `toggleErrorLogging`: enables/disables logging of HTTP errors to the console

### `RciManager`

The `RciManager` class is the one you use to interact with the RCI API.
It relies heavily on the [root API endpoint (`/rci/`)](../../docs/RCI_API.md#31-root-api-resource).
All requests to the API except for the ones that handle background processes
are sent to that endpoint. It's methods accept "RCI queries" as input.
Interactions with [setting](../../docs/RCI_API.md#21-settings) and
[action](../../docs/RCI_API.md#22-actions) resources can be expressed as `RciQuery` objects.
The `RciQuery` interface is defined as follows:

```typescript
export interface RciQuery<PathType extends string = string> { // `PathType` can be narrowed to a subset of valid path strings
  path: PathType;
  data?: Record<string, any> | string | boolean | number; // defaults to {}
  extractDataByPath?: boolean; // defaults to true
}
```

Before being sent to the device, `RciQuery` objects are converted to
an object where the `path` becomes a property path and `data` becomes the value at that path.

For example, a query like:
```typescript
{
  path: 'show.version'
}
```

is converted to:
```typescript
{
  'show': {
    'version': {} // `data` defaults to an empty object
  }
}
```

Similarly, a query with nested path and data:
```typescript
{
  path: 'interface',
  data: {
    name: 'Bridge0',
    description: 'My network'
  }
}
```

becomes:

```typescript
{
  'interface': {
    name: 'Bridge0',
    description: 'My network'
  }
}
```

Sending the nested object to the root API endpoint will result in getting
the response nested in the same way. If the `extractDataByPath` flag
is set to `true` (or not specified: `true` is the default value),
the `RciManager` will extract the relevant part of the response
corresponding to the original query path before returning it to you.

There is a certain flexibility in how the same object can be represented
as an `RciQuery`, for example both

```typescript
{path: 'ip.telnet.session', data: {timeout: 123456}}
```

and

```typescript
{path: 'ip', data: {telnet: {session: {timeout: 123456}}}}
```

will be converted to the same object:
```typescript
{
  'ip': {
    'telnet': {
      'session': {
        'timeout': 123456
      }
    }
  }
}
```

#### `execute` vs `queue`

The `RciManager` provides two methods for executing queries:

- **`execute(query)`**: Sends the HTTP request immediately when you subscribe to the returned Observable.
  You have full control over the subscription lifecycle. This is useful when you need to:
  - Send a query right away without batching
  - Manually control when the HTTP request is made
  - Chain multiple queries with precise timing

- **`queue(query, options?)`**: Adds the query to an internal queue that batches multiple queries together.
  The `RciQueue` handles the subscription internally and manages when HTTP requests are actually sent.
  The queue automatically:
  - Batches multiple queries into a single HTTP request
  - Removes duplicate queries from the batch
  - Waits for a configurable timeout before sending (to allow more queries to be added)
  - Handles priority queries that block the batch queue

Both methods return a [rxjs Observable](https://rxjs.dev/guide/observable)
that you must subscribe to in order to receive the result. The key difference
is that `execute` gives you manual control over the HTTP request timing,
while `queue` delegates that control to the internal queue system for automatic batching.

Below are a few usage examples.

#### 1. A basic example

```typescript
import {Observable, of, firstValueFrom} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
import {RciQuery, RciManager, SessionManager, FetchTransport} from '@rci-tools/core';

// You need to pass an HTTP transport to the RciManager.
// The package provides the FetchTransport class -- a wrapper over built-in `fetch`
// available both in browsers and in Node.js
const transport = new FetchTransport();

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

    const changeSettingResult = await rciManager.queue(changeHomeDescription).toPromise(); // a generic status object

    // relevant action (setting prefixed with 'show.rc')
    const readInterfaceDescription: RciQuery = {
      path: 'show.rc.interface.description', // read from the "running-config"
      data: {name: 'Bridge0'},
    };

    const readSettingResult = await rciManager.queue(readInterfaceDescription).toPromise(); // 'My awesome home network'

    // another action
    const showVersion: RciQuery = { // data will default to {}
      path: 'show.version',
    };

    const actionResult = await rciManager.queue(showVersion).toPromise(); // an object conataing device version info
    
    console.log(changeSettingResult, readSettingResult, actionResult);
  });
```

#### 2. Multiple Queries

```typescript
import {forkJoin} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
// other imports

// ... create an instance of `RciManager` in the same way as in the previous example ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
];

const batch1$ = rciManager.queue(queries); // Both queries will be sent in a single HTTP request

bastch1$
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
        rciManager.execute({path: 'show.system'}),
        rciManager.execute({path: 'show.last-change'}),
        rciManager.execute({path: 'whoami'}),
      ]);
    }),
  )
  .subscribe((joinedResults) => {
    console.log(joinedResults);
  });
```

#### 3. A Priority Query

Priority queries are batched within the next event loop "tick" and blocking
the batch queue (event if it is already waiting for a response).

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

// A priority query, delayed by 200 ms
const executePriority$ = rciManager.queue({path: 'show.system'}, {isPriorityTask: true}).pipe(delay(200));

const all$ = forkJoin([
  execute$,
  executePriority$
]);

// Priority query will block the batched query until it is finished.
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

#### 4. Background Processes

For [background processes](../../docs/RCI_API.md#23-background-processes),
the `RciManager` provides two methods that accept `RciQuery` objects:

- **`executeBackgroundProcess(query, options?)`**: returns an `RciBackgroundProcess` object
  that can be manually aborted. The request to start the background process is sent immediately.
  However, this method does not prevent multiple background processes with the same command
  but different arguments from running in parallel.

- **`queueBackgroundProcess(query, options?)`**: Queues a background process. Queries with the same
  `path` are grouped into a single queue, ensuring that the same command with different arguments
  doesn't run in parallel. This prevents conflicts when, for example, multiple ping operations
  with different hosts are requested.

Both methods return a `RciBackgroundProcess` object with:
- `data$`: An Observable that emits data updates as the background process runs
- `done$`: An Observable that emits when the process finishes (with a reason: `'completed'`, `'aborted'`, or `'timed_out'`)
- `abort()`: A method to manually abort the process

```typescript
interface RciBackgroundProcess {
  data$: Observable<GenericObject | null>;
  done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;

  abort(): void
}
```

Here's a basic example using `executeBackgroundProcess`:

```typescript
const pingQuery: RciQuery = {
  path: 'tools.ping',
  data: {host: 'google.com', packetsize: 84, count: 5}
};

const ping$ = rciManager.executeBackgroundProcess(pingQuery);

ping$.data$
  .subscribe((data) => {
    console.log('Ping result:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping finished:', reason);
  });
```

You can also abort a background process manually:

```typescript
const pingQuery: RciQuery = {
  path: 'tools.ping',
  data: {host: 'google.com', packetsize: 84, count: 50}
};

const ping$ = rciManager.executeBackgroundProcess(pingQuery);

ping$.data$
  .subscribe((data) => {
    console.log('Ping result:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping finished:', reason);
  });

setTimeout(() => ping$.abort(), 4000);
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

