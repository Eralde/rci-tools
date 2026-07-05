**English** | [Русский](SCHEDULING.ru.md)

# Batch Scheduling

&larr; Back to [`@rci-tools/core` README](../README.md)

By default, `queue()` batches queries together in 20ms windows before sending a single HTTP
request. This behavior is controlled by a **scheduler**. You can customize batching through
`RciManagerOptions.batchScheduler` or swap the scheduler at runtime with
`replaceBatchScheduler()`.

**Note:** When `batchScheduler` is provided, `batchTimeout` is **ignored**. To combine a timer
fallback with custom rules, compose them explicitly (see examples below).

## Built-in schedulers

- `TimerScheduler(timeoutMs)` — flushes after a fixed timeout (default behavior).
- `RuleScheduler(rules)` — flushes when any rule predicate returns `true` for the current batch
  snapshot.
- `raceSchedulers(...)` — races multiple schedulers; the first to emit wins.

## `BatchSnapshot`

Schedulers receive a `BatchSnapshot<QueryPath>` on each task add:

```ts
interface BatchSnapshot<QueryPath extends string = string> {
  readonly taskCount: number;
  readonly queryCount: number;
  readonly createdAt: number;
  readonly elapsedMs: number;
  readonly queryPaths: readonly QueryPath[];
}
```

## Examples

**Default timer (20ms):**

```ts
const manager = new RciManager(host, transport);
```

**Custom timer:**

```ts
const manager = new RciManager(host, transport, {batchTimeout: 50});
```

**Hybrid: timer + content-aware rules:**

```ts
import {RciManager, raceSchedulers, TimerScheduler, RuleScheduler, when, pathIncluded} from '@rci-tools/core';

const manager = new RciManager(
  host,
  transport,
  {
    batchScheduler: raceSchedulers(
      new TimerScheduler(20),
      new RuleScheduler([
        when((batch) => batch.queryCount >= 10),
        pathIncluded('show.interface.stat'),
      ]),
    ),
  });
```

**Runtime scheduler replacement:**

```ts
const replacement$ = manager.replaceBatchScheduler(
  new RuleScheduler([pathIncluded('show.version')]),
  {waitIdleFor: 10_000},
);

replacement$.subscribe({
  complete: () => console.log('Scheduler replaced'),
  error: (err) => console.error('Scheduler replacement failed:', err),
});
```

**Custom scheduler:**

```ts
import type {BatchScheduler, BatchSnapshot} from '@rci-tools/core';

const customScheduler: BatchScheduler = {
  schedule(batch$) {
    // simple flush after 3 tasks
    return batch$.pipe(
      filter((snapshot) => snapshot.taskCount >= 3),
      map(() => undefined),
      take(1),
    );
  },
};
```

## Using schedulers with `RciQueue` directly

The same scheduler types work when using [`RciQueue` standalone](./QUEUE.md). Pass a scheduler
via `RciQueueOptions.scheduler`, or swap it at runtime with `queue.setScheduler(scheduler)`.
