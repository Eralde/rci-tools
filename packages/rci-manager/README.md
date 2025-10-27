# `rci-manager`

## Overview

TypeScript library for interacting with the [RCI API](../../docs/RCI_API.md).
Two main classes exported by this package are:

- [SessionManager](./src/session-manager/session-manager.ts): Handles authentication on the device.
- [RciManager](./src/rci-manager/rci.manager.ts): The main class to interact with the API.

The `SessionManager` implements [password-based authentication](../../docs/AUTH.md).

The `RciManager` is responsible for CRUD operations on the device configuration.
It has a few advantages over just using `fetch/xhr/axios/...`:
- multiple separate commands/requests can be batched into a single HTTP request
  (+ duplicates are removed from the batch that is sent to the device)
- there is a simple priority system:
  priority commands block sending the non-priority ones until they are done
- the `RciManager` provides a way to work with the `continued`-requests
  that avoids running same command with different arguments in parallel

Both classes require a [`HTTP transport` instance](./src/transport/http.transport.ts) to
send HTTP requests to the device. The `rci-manager` module providers
[a wrapper over `fetch`](./src/transport/fetch/fetch.transport.ts) for that.
Pass the same instance of `FetchTransport` to both `SessionManager` and `RciManager`
so that requests from `RciManager` are sent within an authorized HTTP session.

## Installation

```bash
npm install rci-manager
```

## Usage

### 1. A basic example

```typescript
import {Observable, of, firstValueFrom} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
import {RciQuery, RciManager, SessionManager, FetchTransport} from 'rci-manager';

// You need to pass an HTTP transport to the RciManager.
// The package provides the FetchTransport class -- a wrapper over built-in `fetch`
// available both in browsers and in Node.js.
const transport = new FetchTransport();

const host = 'http://192.168.1.1'; // device IP address
const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

// Before sending queries, you may need to authenticate:
const auth$: Observable<boolean> = sessionManager.login('admin', 'password')

auth$
  .pipe(
    exhaustMap((isLoggedIn) => {
      if (!isLoggedIn) {
        return of(null);
      }
        
      return rciManager.execute({path: 'show.version'});
    }),
  )
  .subscribe((result) => {
    console.log(result);
  });
```

### 2. Multiple Queries

```typescript
import {forkJoin} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
// other imports

// ... create an instance of `RciManager` in the same way as in the previous example ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
];

const batch1$ = rciManager.execute(queries); // Both queries will be sent in a single HTTP request

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

### 3. A Priority Query

Priority queries are executed immediately, blocking the batch queue:

```typescript
import {delay} from 'rxjs/operators';
import {forkJoin} from 'rxjs';

// ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
  {path: 'show.interface'},
];

const execute$ = rciManager.execute(queries);

// A priority query, delayed by 200 ms
const executePriority$ = rciManager.execute({path: 'show.system'}, {isPriorityTask: true}).pipe(delay(200));

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

### 4. Continued Queries

For commands running in the backgroun, use `executeContinued`:

```typescript
const ping$ = rciManager.executeContinued({path: 'tools.ping', data: {host: 'google.com', packetsize: 84, count: 5}});

ping$.data$
  .subscribe((data) => {
    console.log('Ping result:', data);
  });

continuedQuery.done$
  .subscribe((reason) => {
   console.log('Ping finished:', reason);
  });
```

You also have an option to abort a continued query manually:

```typescript
const ping$ = rciManager.executeContinued({path: 'tools.ping', data: {host: 'google.com', packetsize: 84, count: 50}});

ping$.data$
  .subscribe((data) => {
    console.log('Ping result:', data);
  });

continuedQuery.done$
  .subscribe((reason) => {
    console.log('Ping finished:', reason);
  });

setTimeout(
  () => continuedQuery.abort(),
  4000,
);
```

