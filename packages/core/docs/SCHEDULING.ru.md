[English](SCHEDULING.md) | **Русский**

# Планировщик (Batch Scheduing)

&larr; Назад к [README `@rci-tools/core`](../README.ru.md)

По умолчанию `queue()` объединяет запросы в батчи с окном 20мс перед отправкой одного
HTTP-запроса. Это поведение управляется **планировщиком (scheduler)**. Вы можете настроить
пакетную обработку через `RciManagerOptions.batchScheduler` или заменить планировщик во время
выполнения с помощью `replaceBatchScheduler()`.

**Примечание:** Если передан `batchScheduler`, то `batchTimeout` **игнорируется**. Чтобы
совместить таймер по умолчанию с пользовательскими правилами, скомпонуйте их явно
(см. примеры ниже).

## Встроенные планировщики

- `TimerScheduler(timeoutMs)` — отправляет батч после фиксированной задержки (поведение по
  умолчанию).
- `RuleScheduler(rules)` — отправляет батч, когда любое правило-предикат возвращает `true` для
  текущего снимка батча.
- `raceSchedulers(...)` — запускает несколько планировщиков параллельно; побеждает первый
  отправивший сигнал.

## `BatchSnapshot`

Планировщики получают `BatchSnapshot<QueryPath>` при добавлении каждой задачи:

```ts
interface BatchSnapshot<QueryPath extends string = string> {
  readonly taskCount: number;
  readonly queryCount: number;
  readonly createdAt: number;
  readonly elapsedMs: number;
  readonly queryPaths: readonly QueryPath[];
}
```

> **Важно:** Планировщик получит следующий `BatchSnapshot` только при добавлении новой задачи в
> текущий батч. Правила на основе времени, такие как `when(s => s.elapsedMs >= 500)`, не сработают,
> пока очередь простаивает — комбинируйте их с `after(ms)` или `TimerScheduler`, если нужен таймаут.

## Примеры

**Таймер по умолчанию (20мс):**

```ts
const manager = new RciManager(host, transport);
```

**Свой таймер:**

```ts
const manager = new RciManager(host, transport, {batchTimeout: 50});
```

**Гибрид: таймер + правила на основе содержимого:**

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
  },
);
```

**Замена планировщика во время выполнения:**

```ts
const replacement$ = manager.replaceBatchScheduler(
  new RuleScheduler([pathIncluded('show.version')]),
  {waitIdleFor: 10_000},
);

replacement$.subscribe({
  complete: () => console.log('Планировщик заменён'),
  error: (err) => console.error('Ошибка замены планировщика:', err),
});
```

**Пользовательский планировщик:**

```ts
import type {BatchScheduler, BatchSnapshot} from '@rci-tools/core';

const customScheduler: BatchScheduler = {
  schedule(batch$) {
    // простая отправка после 3 задач
    return batch$.pipe(
      filter((snapshot) => snapshot.taskCount >= 3),
      map(() => undefined),
      take(1),
    );
  },
};
```

## Использование планировщиков напрямую с `RciQueue`

Те же типы планировщиков работают при [использовании `RciQueue` отдельно](./QUEUE.ru.md).
Передайте планировщик через `RciQueueOptions.scheduler` или замените его во время выполнения
с помощью `queue.setScheduler(scheduler)`.
