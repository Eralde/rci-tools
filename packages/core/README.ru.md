[English](README.md) | **Русский**

# `@rci-tools/core`

## Обзор

`@rci-tools/core` &mdash; это `npm`-пакет для взаимодействия с [RCI API](../../docs/RCI_API.ru.md).
Два основных класса, экспортируемых этим пакетом:

- [SessionManager](./src/session-manager/session-manager.ts): Обрабатывает аутентификацию на устройстве.
- [RciManager](./src/rci-manager/rci.manager.ts): Основной класс для работы с API.

`SessionManager` реализует [аутентификацию по паролю](../../docs/AUTH.md).

`RciManager` отвечает за конфигурирование и мониторинг устройства.
Он имеет несколько преимуществ по сравнению с использованием просто `fetch/xhr/axios/...`:
- запросы из нескольких вызовов методов могут быть объединены в один HTTP-запрос
- есть простая система приоритетов:
  приоритетные запросы блокируют обычные, пока не завершатся
- способ работы с фоновыми процессами,
  который предотвращает параллельный запуск одной и той же команды с разными аргументами

Оба класса требуют [`HTTP transport` экземпляра](./src/transport/http.transport.ts) для
отправки HTTP-запросов на устройство. Модуль `@rci-tools/core` предоставляет
[обёртку над `fetch`](./src/transport/fetch/fetch.transport.ts) для этого.
Передавайте один и тот же экземпляр `FetchTransport` в оба класса `SessionManager` и `RciManager`,
чтобы запросы от `RciManager` отправлялись в рамках авторизованной HTTP-сессии.

## Установка

```bash
npm install @rci-tools/core
```

## Справочник

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

Всё довольно просто — используйте `isAuthenticated`/`login`/`logout` для управления сессией аутентификации.
Оставшиеся два метода:
- `getRealmHeader`: позволяет получить имя устройства до аутентификации (например, чтобы показать его на экране входа)
- `toggleErrorLogging`: включает/отключает логирование HTTP-ошибок в консоль

### `RciManager`

`RciManager` используется для взаимодействия с RCI API.
Он имеет следующий интерфейс:

```typescript
interface RciManager<
  QueryPath extends string = string, // допустимые значения 'path' для обычных RCI-запросов
  BackgroundQueryPath extends string = string // допустимые значения 'path' для фоновых RCI-запросов
> {
  execute(query: RciTask<QueryPath>): GenericResponse;
  queue(query: RciTask<QueryPath>, options?: QueueOptions): GenericResponse;
  executeBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundTaskOptions): RciBackgroundProcess;
  queueBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundTaskOptions): RciBackgroundProcess;
}
```

`RciManager` активно использует [корневую конечную точку API (`/rci/`)](../../docs/RCI_API.ru.md#31-корневой-ресурс-api).
Взаимодействие как с [настройками](../../docs/RCI_API.ru.md#21-настройки), так и с
[действиями](../../docs/RCI_API.ru.md#22-действия) выражается через объекты `RciQuery`,
отправляемые на корневую конечную точку API.
Интерфейс `RciQuery` определён так:

```typescript
export interface RciQuery<PathType extends string = string> { // `PathType` можно сузить до подмножества допустимых строк пути
  path: PathType;
  data?: Record<string, any> | string | boolean | number; // по умолчанию {}
  extractData?: boolean; // по умолчанию true
}
```

Перед отправкой на устройство объекты `RciQuery` преобразуются в объект,
где `path` становится путём к свойству, а `data` — значением по этому пути.

Например, запрос:
```typescript
{
  path: 'show.version'
}
```

преобразуется в:
```typescript
{
  'show': {
    'version': {} // `data` по умолчанию — пустой объект
  }
}
```

Аналогично, запрос с вложенным путём и данными:
```typescript
{
  path: 'interface',
  data: {
    name: 'Bridge0',
    description: 'My network'
  }
}
```

превращается в:

```typescript
{
  'interface': {
    name: 'Bridge0',
    description: 'My network'
  }
}
```

Отправка такого вложенного объекта на корневую конечную точку API приведёт к получению
ответа, вложенного аналогичным образом. Если флаг `extractData`
установлен в `true` (или не указан: по умолчанию `true`),
`RciManager` извлечёт соответствующую часть ответа,
относящуюся к исходному пути запроса, прежде чем вернуть её вам.

Есть определённая гибкость в том, как один и тот же объект может быть представлен
как `RciQuery`, например, оба варианта

```typescript
{path: 'ip.telnet.session', data: {timeout: 123456}}
```

и

```typescript
{path: 'ip', data: {telnet: {session: {timeout: 123456}}}}
```

будут преобразованы в один и тот же объект в теле HTTP-запроса:
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

Вы можете использовать то представление, которое вам удобнее.

#### `execute` vs `queue`

`RciManager` предоставляет два метода для отправки API-запросов:

- **`execute(query)`**: Отправляет HTTP-запрос при подписке на возвращаемый Observable.
  Вы полностью контролируете жизненный цикл подписки. Это может быть полезно, если нужно:
  - Вручную управлять моментом отправки HTTP-запроса
  - Последовательно вызывать несколько запросов с точным контролем времени

- **`queue(query, options?)`**: Добавляет запрос во внутреннюю очередь, которая объединяет несколько запросов в один HTTP-запрос.
  `RciQueue` сам управляет подпиской и моментом отправки HTTP-запросов.
  Очередь автоматически:
  - Объединяет несколько запросов в один HTTP-запрос
  - Удаляет дублирующиеся запросы из пакета
  - Ждёт настраиваемый таймаут перед отправкой (чтобы успели добавиться новые запросы)
  - Обрабатывает приоритетные запросы через отдельную очередь, блокируя обычную

Оба метода возвращают [rxjs Observable](https://rxjs.dev/guide/observable),
на который нужно подписаться, чтобы получить результат. Ниже приведено несколько примеров использования.

#### 1. Базовый пример

```typescript
import {Observable, of, firstValueFrom} from 'rxjs';
import {exhaustMap} from 'rxjs/operators';
import {RciQuery, RciManager, SessionManager, FetchTransport} from '@rci-tools/core';

// Необходимо передать HTTP transport в RciManager.
// Пакет предоставляет класс FetchTransport — обёртку над встроенным `fetch`,
// доступным как в браузерах, так и в Node.js
const transport = new FetchTransport();

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
    // преобразуются в Promise для простоты примера.

    // настройка
    const changeHomeDescription: RciQuery = {
      path: 'interface',
      data: {name: 'Bridge0', description: 'My awesome home network'},
    };

    const changeSettingResult = await rciManager.queue(changeHomeDescription).toPromise(); // объект статуса

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

#### 2. Несколько запросов

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

bastch1$
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

#### 3. Приоритетные запросы

Если вы используете очередь для пакетирования, но нужно отправить запрос почти сразу,
можно отправить его как приоритетный. Приоритетные запросы пакетируются только в рамках
текущего "тика" event loop. Приоритетная очередь блокирует обычную очередь до тех пор,
пока не опустеет (даже если обычная уже ждёт ответа).

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

// Приоритетный запрос, с задержкой 200 мс
const executePriority$ = rciManager.queue({path: 'show.system'}, {isPriorityTask: true}).pipe(delay(200));

const all$ = forkJoin([
  execute$,
  executePriority$
]);

// Приоритетный запрос заблокирует пакетный запрос, пока не завершится.
// Если посмотреть, сколько HTTP-запросов было отправлено, получится три:
//
// 1. Пакетный запрос из первого вызова `execute` -> отменён приоритетным запросом
// 2. Приоритетный запрос из второго вызова `execute`
// 3. Пакетный запрос из первого вызова `execute` -> повторно выполнен после приоритетного
all$
  .subscribe((allResults) => {
    console.log(allResults);
  });
```

#### 4. Фоновые процессы

Для [фоновых процессов](../../docs/RCI_API.ru.md#23-фоновые-процессы)
`RciManager` предоставляет два метода, принимающих объекты `RciQuery`:

- **`executeBackgroundProcess(query, options?)`**: возвращает объект `RciBackgroundProcess`,
  который можно вручную прервать. Запрос на запуск фонового процесса отправляется сразу.
  Однако этот метод не предотвращает параллельный запуск нескольких фоновых процессов
  с одной и той же командой, но разными аргументами.

- **`queueBackgroundProcess(query, options?)`**: Ставит фоновый процесс в очередь. Запросы с одинаковым
  `path` группируются в одну очередь, что гарантирует, что одна и та же команда с разными аргументами
  не будет выполняться параллельно. Это предотвращает конфликты, например, при одновременном запуске
  нескольких операций ping с разными хостами.

Оба метода возвращают объект `RciBackgroundProcess` со следующими свойствами:
- `data$`: Observable, который выдаёт обновления данных по мере выполнения фонового процесса
- `done$`: Observable, который выдаёт событие по завершении процесса (с причиной: `'completed'`, `'aborted'` или `'timed_out'`)
- `abort()`: Метод для ручного прерывания процесса

```typescript
interface RciBackgroundProcess {
  data$: Observable<GenericObject | null>;
  done$: Observable<RCI_BACKGROUND_PROCESS_FINISH_REASON>;

  abort(): void
}
```

Пример использования `executeBackgroundProcess`:

```typescript
const pingQuery: RciQuery = {
  path: 'tools.ping',
  data: {
    host: 'google.com',
    packetsize: 84,
    count: 5,
  },
};

const ping$ = rciManager.executeBackgroundProcess(pingQuery);

ping$.data$
  .subscribe((data) => {
    console.log('Результат ping:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping завершён:', reason);
  });
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

const ping$ = rciManager.executeBackgroundProcess(pingQuery);

ping$.data$
  .subscribe((data) => {
    console.log('Результат ping:', data);
  });

ping$.done$
  .subscribe((reason) => {
    console.log('Ping завершён:', reason);
  });

setTimeout(() => ping$.abort(), 4000);
```

Для управления несколькими фоновыми процессами с одной командой, но разными аргументами,
используйте `queueBackgroundProcess`, чтобы они не выполнялись параллельно:

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

В этом примере два запроса `tools.ping` будут объединены в одну очередь (выполняться последовательно),
и два запроса `components.list` также будут объединены, предотвращая конфликты
от одновременного запуска одной и той же команды с разными аргументами.
