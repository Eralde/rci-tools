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
  readonly isBusy: boolean; // синхронный снимок isBusy$

  constructor(
    rciPath: string, // полный URL корневого RCI-эндпоинта, напр. 'http://192.168.1.1/rci/'
    httpTransport: HttpTransport<ResponseType>,
    options?: Partial<RciQueueOptions<ResponseType, QueryPath>>,
  ) { /* ... */
  }

  public addTask(query: RciTask, saveConfiguration?: boolean): Observable<any> { /* ... */
  }

  public setScheduler(scheduler: BatchScheduler<QueryPath>): void { /* ... */
  }

  public destroy(): void { /* ... */
  }
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

### Семантика блокирующей очереди (вытеснение)

Если задана опция `options.blockerQueue`, блокирующая очередь **вытесняет** данную очередь
всякий раз, когда становится занятой &mdash; независимо от того, что данная очередь делает в этот
момент:

| Состояние данной очереди | Что происходит при вытеснении                                                                                                                       |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `READY`                  | Пока ничего; при следующей попытке отправки блокирующая очередь проверяется снова, и отправка откладывается, если она всё ещё занята.               |
| `BATCHING_TASKS`         | Окно планирования закрывается; собранные задачи остаются в очереди. Состояние становится `PENDING`.                                                 |
| `AWAITING_RESPONSE`      | Отправленный HTTP-запрос **бросается**: его ответ будет проигнорирован, а его задачи возвращаются в начало очереди. Состояние становится `PENDING`. |
| `PENDING`                | Очередь уже ждёт; ничего не меняется.                                                                                                               |

В состоянии `PENDING` новые задачи по-прежнему принимаются &mdash; они просто добавляются в очередь.
Как только блокирующая очередь переходит в `READY`, **все** накопленные задачи (как возвращённые,
так и новые) немедленно отправляются одним батчем, без ожидания нового окна планирования. Каждый
подписчик по-прежнему получает ровно один результат &mdash; от того батча, который реально завершился.

> **Неидемпотентные команды могут выполниться дважды при вытеснении.** Отказ от отправленного
> запроса отбрасывает только *ответ* &mdash; сам запрос уже дошёл до устройства, и оно может его
> выполнить. Повторно отправленный батч выполнит те же запросы ещё раз. Для опроса `show.*` это
> осознанный компромисс (актуальность данных после приоритетной работы важнее дедупликации), но
> это означает, что вытесненный батч с командами записи (включая запрос
> `system.configuration.save`, добавляемый опцией `saveConfiguration: true`) может быть применён
> дважды.
>
> Избежать вытеснения можно следующими способами:
>
> - при использовании `RciManager` отправляйте команды записи через приоритетную очередь
>   (`queue(query, {isPriorityTask: true})`) &mdash; у приоритетной очереди нет блокирующей, и она
>   никогда не вытесняется;
> - либо используйте отдельный `RciQueue` без `blockerQueue` для команд записи &mdash;
>   система из двух очередей в `RciManager` полностью опциональна.

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
