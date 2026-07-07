**English** | [Русский](QUEUE.ru.md)

# `RciQueue` and Query Stats

&larr; Back to [`@rci-tools/core` README](../README.md)

## Using `RciQueue` standalone

`RciManager` implies certain query priority model: it owns two `RciQueue` instances (a batching
queue and a priority queue) internally plus background-process handling and stats.
However, you can use `RciQueue` directly for it's the batching behavior &mdash; combining many small
queries into a single HTTP request within a scheduling window &mdash.

`RciQueue` is exported from `@rci-tools/core`:

```typescript
class RciQueue<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  readonly state$: Observable<RciQueueState>;
  readonly isBusy$: Observable<boolean>;

  constructor(
    rciPath: string, // full URL of the root RCI endpoint, e.g. 'http://192.168.1.1/rci/'
    httpTransport: HttpTransport<ResponseType>,
    options?: Partial<RciQueueOptions<ResponseType, QueryPath>>,
  );

  addTask(query: RciTask, saveConfiguration?: boolean): Observable<any>;
  setScheduler(scheduler: BatchScheduler<QueryPath>): void;
  destroy(): void;
}
```

The constructor options are:

```typescript
interface RciQueueOptions<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  batchTimeout: number;                          // ms window used by the default TimerScheduler
  blockerQueue: RciQueue<ResponseType, QueryPath> | null; // another queue that blocks this one while busy
  queueName?: string;                            // label reported to the stats collector
  scheduler?: BatchScheduler<QueryPath>;         // custom scheduler (overrides `batchTimeout`)
  statsCollector?: QueryStatsCollector | null;   // optional stats collector
}
```

Notable differences from `RciManager`:

- You construct `RciQueue` with the **full RCI endpoint URL** (`.../rci/`), not just the host.
  `RciManager` builds this internally as `` `${host}/rci/` ``.
- `RciQueue` does not provide any way to handle background-processes
- Call `destroy()` yourself when you are done with the `RciQueue` instance

### Basic standalone usage

```typescript
import {RciQuery, RciQueue, FetchTransport} from '@rci-tools/core';

const transport = new FetchTransport();
const rciPath = 'http://192.168.1.1/rci/'; // note the trailing `/rci/`

const queue = new RciQueue(rciPath, transport, {batchTimeout: 20});

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
];

// Both tasks added within the 20ms window are sent as a single HTTP request.
queue.addTask(queries)
  .subscribe((results) => {
    console.log(results);
  });

// Later, once you no longer need the queue:
queue.destroy();
```

### Reproducing the priority system with two queues

```typescript
import {RciQueue, FetchTransport} from '@rci-tools/core';

const transport = new FetchTransport();
const rciPath = 'http://192.168.1.1/rci/';

const priorityQueue = new RciQueue(rciPath, transport, {
  batchTimeout: 0,
  queueName: 'priority',
});

const batchQueue = new RciQueue(rciPath, transport, {
  batchTimeout: 20,
  queueName: 'batch',
  blockerQueue: priorityQueue, // batchQueue waits while priorityQueue is busy
});

// Priority tasks block the batch queue until they finish.
priorityQueue.addTask({path: 'show.system'}).subscribe();
batchQueue.addTask({path: 'show.version'}).subscribe();
```

### Custom scheduling and stats

`RciQueue` accepts the same schedulers described in [Batch Scheduling](./SCHEDULING.md)
and an optional `QueryStatsCollector`. Default scheduler is a `TimerScheduler` that flushes
the queue after `batchTimeout` milliseconds.

```typescript
import {RciQueue, QueryStatsCollector, RuleScheduler, when, FetchTransport} from '@rci-tools/core';

const transport = new FetchTransport();
const stats = new QueryStatsCollector();

stats.toggle(true);

const queue = new RciQueue(
  'http://192.168.1.1/rci/',
  transport,
  {
    scheduler: new RuleScheduler([when((batch) => batch.queryCount >= 10)]),
    statsCollector: stats,
    queueName: 'my-queue',
  },
);

stats.stats$.subscribe((entry) => console.log('batch stats:', entry));
```

You can also swap the scheduler at runtime with `setScheduler()`, but only while the
queue is idle (`state$` === `RCI_QUEUE_STATE.READY`); otherwise it throws `QueueNotIdleError`.

## Query stats

When stats collection is enabled on the `QueryStatsCollector` passed to `RciQueue`,
the `stats$` observable emits a `QueryStats` object for every completed batch:

```typescript
interface QueryStats<QueryPath extends string = string> {
  queueName: string;
  taskCount: number;
  queryCount: number;
  queryPaths: readonly QueryPath[];
  sentAt: number;
  durationMs: number;
  success: boolean;
  error?: unknown;
}
```
