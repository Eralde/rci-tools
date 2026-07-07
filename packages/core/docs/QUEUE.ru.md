[English](QUEUE.md) | **Русский**

# `RciQueue` и статистика запросов

&larr; Назад к [README `@rci-tools/core`](../README.ru.md)

## Использование `RciQueue`

`RciManager` предполагает определённую модель приоритетов запросов: внутри он содержит два
экземпляра `RciQueue` (`batch`-очередь и приоритетную очередь), а также обработку фоновых
процессов и статистику. Однако вы можете использовать `RciQueue` напрямую &mdash; для батчинга
&mdash; объединения множества мелких запросов в один HTTP-запрос.

`RciQueue` экспортируется из `@rci-tools/core`:

```typescript
class RciQueue<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  readonly state$: Observable<RciQueueState>;
  readonly isBusy$: Observable<boolean>;

  constructor(
    rciPath: string, // полный URL корневого RCI-эндпоинта, напр. 'http://192.168.1.1/rci/'
    httpTransport: HttpTransport<ResponseType>,
    options?: Partial<RciQueueOptions<ResponseType, QueryPath>>,
  );

  addTask(query: RciTask, saveConfiguration?: boolean): Observable<any>;
  setScheduler(scheduler: BatchScheduler<QueryPath>): void;
  destroy(): void;
}
```

Опции конструктора:

```typescript
interface RciQueueOptions<ResponseType extends BaseHttpResponse, QueryPath extends string = string> {
  batchTimeout: number;                          // окно в мс для TimerScheduler по умолчанию
  blockerQueue: RciQueue<ResponseType, QueryPath> | null; // другая очередь, блокирующая эту, пока занята
  queueName?: string;                            // метка, передаваемая в сборщик статистики
  scheduler?: BatchScheduler<QueryPath>;         // свой планировщик (перекрывает `batchTimeout`)
  statsCollector?: QueryStatsCollector | null;   // опциональный сборщик статистики
}
```

Ключевые отличия от `RciManager`:

- `RciQueue` требует **полный URL RCI-эндпоинта** (`.../rci/`) в качестве аргумента конструктора;
- `RciQueue` не предоставляет никакого способа работы с фоновыми процессами;
- когда закончите работу с экземпляром `RciQueue` &mdash; вызовите `destroy()` самостоятельно;

### Базовое использование отдельно

```typescript
import {RciQuery, RciQueue, FetchTransport} from '@rci-tools/core';

const transport = new FetchTransport();
const rciPath = 'http://192.168.1.1/rci/'; // обратите внимание на завершающий `/rci/`

const queue = new RciQueue(rciPath, transport, {batchTimeout: 20});

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
];

// Обе задачи, добавленные в течение окна 20мс, отправляются одним HTTP-запросом.
queue.addTask(queries)
  .subscribe((results) => {
    console.log(results);
  });

// Позже, когда очередь больше не нужна:
queue.destroy();
```

### Система приоритетов с двумя очередями

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
  blockerQueue: priorityQueue, // batchQueue ждёт, пока priorityQueue занята
});

// Приоритетные задачи блокируют `batchQueue`
priorityQueue.addTask({path: 'show.system'}).subscribe();
batchQueue.addTask({path: 'show.version'}).subscribe();
```

### Своё планирование и статистика

`RciQueue` принимает те же планировщики, что описаны в разделе
[Пакетное планирование](./SCHEDULING.ru.md), и опциональный `QueryStatsCollector`.
Планировщик по умолчанию &mdash; `TimerScheduler`, сбрасывающий очередь через `batchTimeout`
миллисекунд.

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

stats.stats$.subscribe((entry) => console.log('статистика батча:', entry));
```

Также можно заменить планировщик во время выполнения с помощью `setScheduler()`, но только
когда очередь простаивает (`state$` === `RCI_QUEUE_STATE.READY`); иначе будет выброшено
исключение `QueueNotIdleError`.

## Статистика запросов

Когда сбор статистики включён на `QueryStatsCollector`, переданном в `RciQueue`,
Observable `stats$` выдаёт объект `QueryStats` для каждого завершённого батча:

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
