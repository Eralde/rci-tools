[English](README.md) | **Русский**

# `@rci-tools/core`

## Введение

`@rci-tools/core` &mdash; это `npm`-пакет для взаимодействия с [RCI API](../../docs/RCI_API.ru.md).
Два основных класса, экспортируемых этим пакетом:

- [SessionManager](./src/session-manager/session-manager.ts):
  реализует [аутентификацию по паролю](../../docs/AUTH.md);
- [RciManager](./src/rci-manager/rci.manager.ts): основной класс для работы с API в едином стиле;

Оба класса требуют экземпляр [`HTTP транспорта`](./src/transport/http.transport.ts)
для отправки HTTP-запросов к устройству. Модуль `@rci-tools/core` предоставляет
[обёртку над `fetch`](./src/transport/fetch/fetch.transport.ts) в качестве такого транспорта.
Передавайте один и тот же экземпляр `FetchTransport` и в `SessionManager`,
и в `RciManager`, чтобы запросы от `RciManager` отправлялись в рамках авторизованной HTTP-сессии.

## Установка

```bash
npm install @rci-tools/core
```

## Описание и примеры использования

### `SessionManager`

`SessionManager` используется для управления аутентификацией.
Он имеет следующий интерфейс:

```typescript
interface SessionManager<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  isAuthenticated(): Observable<boolean>;
  login(username: string, password: string): Observable<boolean>;
  logout(): Observable<unknown>;

  getRealmHeader(): Observable<string>;
  toggleErrorLogging(isEnabled: boolean): void;
}
```

Используйте методы `isAuthenticated`/`login`/`logout` для управления сессией.
Оставшиеся два метода предназначены для вспомогательных задач:

- `getRealmHeader`: позволяет получить имя устройства до аутентификации (например, чтобы показать
  его на экране входа)
- `toggleErrorLogging`: включает/отключает логирование HTTP-ошибок в консоль

### `RciManager`

Класс `RciManager` используется для взаимодействия с RCI API.
Он имеет несколько преимуществ по сравнению с использованием непосредственно `fetch/xhr/axios/...`:

- несколько запросов через `RciManager` могут быть объединены в один HTTP-запрос к устройству
- реализована простая система приоритетов:
  приоритетные запросы блокируют обычные, пока не завершатся
- реализован удобный способ работы с фоновыми процессами

Класс `RciManager` имеет следующий интерфейс:

```typescript
interface RciManager<
  QueryPath extends string = string, // допустимые значения 'path' для обычных RCI-запросов
  BackgroundQueryPath extends string = string // допустимые значения 'path' для фоновых процессов
> {
  readonly stats$: Observable<QueryStats<QueryPath>>;

  toggleStats(enabled: boolean): void;

  replaceBatchScheduler(scheduler: BatchScheduler<QueryPath>, options?: {
    waitIdleFor?: number
  }): Observable<void>;

  execute(query: RciTask<QueryPath>): Observable<any>;
  queue(query: RciTask<QueryPath>, options?: QueueOptions): Observable<any>;

  initBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundProcessOptions): RciBackgroundProcess;
  queueBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundProcessOptions): RciBackgroundProcess;

  destroy(): void;
}
```

Дополнительные члены класса:

- `stats$`: выдаёт объект `QueryStats` для каждого завершённого батча, если сбор статистики включён.
- `toggleStats(enabled)`: включает или отключает сбор статистики.
- `replaceBatchScheduler(scheduler, options?)`: заменяет планировщик батчей во время выполнения,
  дожидаясь, пока текущий батч освободится. `options.waitIdleFor` по умолчанию `30000` мс.
  Выбрасывает `SchedulerReplacementInProgressError`, если другая замена уже выполняется.
- `destroy()`: освобождает внутренние очереди, очереди фоновых процессов и сборщик статистики.

`RciManager` активно использует [корневой ресурс API (
`/rci/`)](../../docs/RCI_API.ru.md#31-корневой-ресурс-api).
Взаимодействие как с [настройками](../../docs/RCI_API.ru.md#21-настройки),
так и с [действиями](../../docs/RCI_API.ru.md#22-действия) в нем реализовано через объекты
`RciQuery`,
отправляемые на корневой ресурс. Интерфейс `RciQuery` выглядит следующим образом:

```typescript
export interface RciQuery<PathType extends string = string> { // `PathType` можно сузить до подмножества допустимых значений `path`
  path: PathType;
  data?: Record<string, any> | string | boolean | number; // по умолчанию {}
  extractData?: boolean; // по умолчанию true
}

export type RciTask<PathType extends string = string> = RciQuery<PathType> | RciQuery<PathType>[];
```

Метод `queue()` принимает необязательный объект `QueueOptions`:

```typescript
interface QueueOptions {
  isPriorityTask?: boolean;  // отправить через приоритетную очередь. По умолчанию: false
  saveConfiguration?: boolean; // добавить запрос system/configuration/save. По умолчанию: false
}
```

Перед отправкой на устройство объекты `RciQuery` преобразуются в объект,
где `path` становится "путём" ко вложенному свойству, а `data` — значением по этому пути.

Например, запрос:

```typescript
const query = {
  path: 'show.version'
};
```

преобразуется в (`data` по умолчанию — пустой объект):

```json
{
  "show": {
    "version": {}
  }
}
```

Аналогично, запрос с `path` и `data`:

```typescript
const query = {
  path: 'interface',
  data: {
    name: 'Bridge0',
    description: 'My network'
  }
};
```

превращается в:

```json
{
  "interface": {
    "name": "Bridge0",
    "description": "My network"
  }
}
```

Отправка такого вложенного объекта на корневой ресурс RCI API вернет объект,
в котором нужные данные вложены аналогичным образом. Если флаг `extractData`
установлен в `true` (или не указан: он имеет значение `true` по умолчанию),
то `RciManager` извлечёт нужную часть ответа автоматически.

Существует определённая гибкость в том, как один и тот же объект
может быть представлен как `RciQuery`. Например, оба запроса

```typescript
const query = {path: 'ip.telnet.session', data: {timeout: 123456}};
```

и

```typescript
const query = {path: 'ip', data: {telnet: {session: {timeout: 123456}}}};
```

будут преобразованы в один и тот же объект:

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

Вы можете использовать тот вариант, который удобнее для вас.

#### `execute` vs `queue`

`RciManager` предоставляет два метода для отправки запросов к API:

- **`execute(query)`**: Отправляет HTTP-запрос при подписке на возвращаемый Observable.
  Вы полностью контролируете жизненный цикл подписки. Это может быть полезно, если нужно:
    - вручную управлять моментом отправки HTTP-запроса
    - последовательно отправить несколько запросов с точным контролем времени

- **`queue(query, options?)`**: Добавляет запрос во внутреннюю очередь,
  которая объединяет несколько запросов в один HTTP-запрос. `RciManager` сам управляет
  подпиской и моментом отправки HTTP-запросов. Очередь автоматически:
    - объединяет несколько запросов в один HTTP-запрос
    - удаляет дублирующиеся запросы из батча (batch)
    - ждёт определённое время перед отправкой HTTP-запроса, собирая данные из разных вызовов `queue`
    - обрабатывает приоритетные запросы через отдельную очередь, блокируя обычную

Оба метода возвращают [rxjs Observable](https://rxjs.dev/guide/observable),
на который нужно подписаться, чтобы получить результат. Ниже приведено несколько примеров
использования.

#### Пакетное планирование (Batch Scheduling)

По умолчанию `queue()` объединяет запросы в батчи с окном 20мс перед отправкой одного HTTP-запроса.
Это поведение управляется **планировщиком (scheduler)**. Вы можете настроить пакетную обработку
через `RciManagerOptions.batchScheduler` или заменить планировщик во время выполнения с помощью
`replaceBatchScheduler()`.

**Примечание:** Если передан `batchScheduler`, то `batchTimeout` **игнорируется**. Чтобы совместить
таймер по умолчанию с пользовательскими правилами, скомпонуйте их явно (см. примеры ниже).

##### Встроенные планировщики

- `TimerScheduler(timeoutMs)` — отправляет батч после фиксированной задержки (поведение по
  умолчанию).
- `RuleScheduler(rules)` — отправляет батч, когда любое правило-предикат возвращает `true` для
  текущего снимка батча.
- `raceSchedulers(...)` — запускает несколько планировщиков параллельно; побеждает первый
  отправивший сигнал.

##### `BatchSnapshot`

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

##### Примеры

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

#### Примеры использования

##### 1. Базовый пример

```typescript
import {Observable, of, firstValueFrom} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
import {RciQuery, RciManager, SessionManager, FetchTransport} from '@rci-tools/core';

const transport = new FetchTransport(); // HTTP-транспорт (обёртка над встроенным `fetch`)

const host = 'http://192.168.1.1'; // IP-адрес устройства
const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

// Перед отправкой запросов, возможно, потребуется аутентификация:
const auth$: Observable<boolean> = sessionManager.login('admin', 'password')

auth$
  .subscribe(async (isLoggedIn) => {
    if (!isLoggedIn) {
      console.error('Ошибка аутентификации');

      return Promise.resolve(null);
    }

    // Следующие запросы будут выполняться последовательно;
    // Observable, возвращаемые методом `queue`,
    // преобразуются в Promise для того, чтобы код примера было проще читать.

    // настройка
    const changeHomeDescription: RciQuery = {
      path: 'interface',
      data: {name: 'Bridge0', description: 'My awesome home network'},
    };

    const changeSettingResult = await rciManager.queue(changeHomeDescription).toPromise(); // объект со статусом выполнения команды

    // соответствующее действие (настройка с префиксом 'show.rc')
    const readInterfaceDescription: RciQuery = {
      path: 'show.rc.interface.description', // чтение из "running-config"
      data: {name: 'Bridge0'},
    };

    const readSettingResult = await rciManager.queue(readInterfaceDescription).toPromise(); // 'My awesome home network'

    // другое действие
    const showVersion: RciQuery = { // data по умолчанию {}
      path: 'show.version',
    };

    const actionResult = await rciManager.queue(showVersion).toPromise(); // объект с информацией о версии устройства

    console.log(changeSettingResult, readSettingResult, actionResult);
  });
```

##### 2. Несколько запросов

```typescript
import {forkJoin} from 'rxjs';
import {delay, exhaustMap} from 'rxjs/operators';
// другие импорты

// ... создайте экземпляр `RciManager` так же, как в предыдущем примере ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
];

const batch1$ = rciManager.queue(queries); // Оба запроса будут отправлены одним HTTP-запросом

batch1$
  .pipe(
    exhaustMap((results) => {
      queries.forEach((query, index) => {
        console.log({
          query,
          result: results[index],
        });
      });

      // Эти запросы также будут отправлены одним HTTP-запросом
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

##### 3. Приоритетные запросы

Если вам требуется отправить запрос, не дожидаясь пока завершится сбора данных для батча,
можно отправить его как приоритетный. Приоритетные запросы группируются
только в рамках следующей "микрозадачи" (event loop microtask).
Приоритетная очередь блокирует обычную, пока не опустеет
(даже если обычная уже ждёт ответа на HTTP-запрос).

```typescript
import {delay} from 'rxjs/operators';
import {forkJoin} from 'rxjs';
// другие импорты

// ... создайте экземпляр `RciManager` так же, как в предыдущем примере ...

const queries: RciQuery[] = [
  {path: 'show.version'},
  {path: 'show.identification'},
  {path: 'show.interface'},
];

const execute$ = rciManager.queue(queries);

// Приоритетный запрос, с задержкой 20 мс (время сбора данных для "батча" в обычной очереди)
const executePriority$ = rciManager.queue({path: 'show.system'}, {isPriorityTask: true}).pipe(delay(20));

const all$ = forkJoin([
  execute$,
  executePriority$
]);

// Приоритетный запрос заблокирует обычный, пока не завершится.
// Если посмотреть, сколько HTTP-запросов было отправлено, то их окажется три:
//
// 1. батч-запрос из первого вызова `execute` -> отменён приоритетным запросом
// 2. приоритетный запрос из второго вызова `execute`
// 3. батч-запрос из первого вызова `execute` -> повторно выполнен после приоритетного
all$
  .subscribe((allResults) => {
    console.log(allResults);
  });
```

#### Фоновые процессы

Для [фоновых процессов](../../docs/RCI_API.ru.md#23-фоновые-процессы) `RciManager`
предоставляет два метода, также принимающих объекты `RciQuery`
и дополнительные настройки:

```typescript
interface RciBackgroundProcessOptions {
  pollInterval?: number; // интервал между GET-запросами в мс. По умолчанию: 1000
  timeout?: number;      // таймаут до прерывания процесса в мс. По умолчанию: 0 (без таймаута)
}
```

Разница между двумя методами заключается в том, когда фоновый процесс будет запущен:

- **`initBackgroundProcess(query, options?)`**: возвращает объект `RciBackgroundProcess`,
  который нужно запускать вручную. Этот метод полезен, если вам нужен полный контроль
  над жизненным циклом фонового процесса (вы также можете вручную прервать процесс до его
  завершения).

- **`queueBackgroundProcess(query, options?)`**: Ставит фоновый процесс в очередь.
  Запросы с одинаковым значением `path` группируются в одну очередь, что гарантирует,
  что одна и та же команда с разными аргументами не будет выполняться параллельно.
  Это важно для обхода ограничений API при работе в браузере, где обычно используется
  одна HTTP-сессия для всех запросов.

Оба метода возвращают объект `RciBackgroundProcess` со следующими свойствами:

- `start(): boolean`: Запускает процесс вручную. Возвращает `false`, если процесс уже запущен.
- `attachToRunning(): boolean`: Подключается к уже запущенному фоновому процессу
  (например, запущенному через `RciManager.execute()`). Пропускает начальный POST-запрос
  и сразу начинает опрос через GET. Возвращает `false`, если `start()` уже был вызван
  или процесс не в состоянии `INIT`.
- `abort(): boolean`: Прерывает процесс вручную. Возвращает `false`, если процесс не запущен.
- `state$`: Observable, который выдаёт изменения состояния процесса (`RCI_BACKGROUND_PROCESS_STATE`)
- `data$`: Observable, который выдаёт обновления данных по мере выполнения фонового процесса
- `result$`: Observable, который выдаёт финальный результат один раз, непосредственно перед
  завершением процесса.
  Не выдаёт значения при прерывании или таймауте.
- `done$`: Observable, который выдаёт значение по завершении процесса (
  `RCI_BACKGROUND_PROCESS_FINISH_REASON`)

```typescript
interface RciBackgroundProcess {
  state$: Observable<RCI_BACKGROUND_PROCESS_STATE>;
  data$: Observable<GenericObject | null>;
  result$: Observable<GenericObject | null>;
  done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;

  start(): boolean;
  attachToRunning(): boolean;
  abort(): boolean;
  getState(): RCI_BACKGROUND_PROCESS_STATE;
  destroy(): void;
}
```

Вот базовый пример использования `initBackgroundProcess`:

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
    console.log('Результат ping:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping завершён:', reason);
  });

ping$.start();
```

Вы также можете вручную прервать фоновый процесс до его завершения:

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
    console.log('Результат ping:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping завершён:', reason);
  });

ping$.start();

setTimeout(() => ping$.abort(), 4000);
```

Если фоновый процесс уже был запущен (например, через `RciManager.execute()`),
к нему можно подключиться с помощью `attachToRunning()`, чтобы получать
результаты опроса без отправки нового POST-запроса:

```typescript
import {RciManager, RciQuery} from '@rci-tools/core';

const host = 'http://192.168.1.1';
const transport = new FetchTransport();
const rciManager = new RciManager(host, transport);

// Шаг 1: запускаем фоновый процесс через обычный вызов API
const startFwCheckQuery: RciQuery = {
  path: 'components.list',
  data: {},
};

await firstValueFrom(rciManager.execute(startFwCheckQuery));
// Устройство отвечает {continued: true} — процесс запущен

// Шаг 2: создаём экземпляр фонового процесса и подключаемся к нему
const pollProcess = rciManager.initBackgroundProcess(
  {path: 'components.list'},
  {pollInterval: 1000, timeout: 30000},
);

pollProcess.result$
  .subscribe((result) => {
    console.log('Проверка обновлений завершена:', result);
  });

pollProcess.attachToRunning(); // `pollProcess` сразу начнет с GET запроса
```

Для управления несколькими фоновыми процессами с одной и той же командой,
но разными аргументами, используйте `queueBackgroundProcess`,
чтобы они не выполнялись параллельно:

```typescript
import {forkJoin, firstValueFrom} from 'rxjs';

// Несколько фоновых процессов с одинаковым path, но разными данными
const continuedQueries: RciQuery[] = [
  {path: 'tools.ping', data: {host: 'google.com', packetsize: 84, count: 5}},
  {path: 'tools.ping', data: {host: 'github.com', packetsize: 84, count: 5}},
  {path: 'components.list', data: {sandbox: 'stable'}},
  {path: 'components.list', data: {sandbox: 'draft'}},
];

// Поставить все процессы в очередь — запросы с одинаковым path будут объединены
const backgroundTasks = continuedQueries.map((query) => {
  return rciManager.queueBackgroundProcess(query);
});

// Следить за завершением всех задач
const done$ = backgroundTasks.map((task) => task.done$);
const finalResults = await firstValueFrom(forkJoin(done$));

console.log('Все фоновые процессы завершены:', finalResults);
```

В этом примере два запроса `tools.ping` будут выполнены последовательно
и два запроса `components.list` также будут выполнены последовательно;
Последовательное выполнение позволяет избежать неоднозначности, связанной с тем,
что, когда несколько экземпляров одного и того же фонового процесса запущены
параллельно из одной HTTP-сессии, невозможно понять, статус какого из процессов
возвращается в ответ на GET-запрос.

#### Статистика запросов

Когда сбор статистики включён через `toggleStats(true)`, `stats$` выдаёт объект
`QueryStats` для каждого завершённого батча:

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
