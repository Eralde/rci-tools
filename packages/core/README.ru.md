[English](README.md) | **Русский**

# `@rci-tools/core`

## Введение

`@rci-tools/core` &mdash; это `npm`-пакет для взаимодействия с [RCI API](../../docs/RCI_API.ru.md).
Два основных класса, экспортируемых этим пакетом:

- [SessionManager](./src/session-manager/session-manager.ts):
  реализует [аутентификацию по паролю](../../docs/AUTH.md);
- [RciManager](./src/rci-manager/rci.manager.ts): основной класс для работы с API в едином стиле;

Оба класса требуют экземпляр [`HTTP транспорта`](./src/transport/http.transport.ts)
для отправки HTTP-запросов к устройству. Пакет предоставляет два браузерных транспорта:

- [`FetchTransport`](./src/transport/fetch/fetch.transport.ts) — обёртка над встроенным API `fetch`;
- [`XHRTransport`](./src/transport/xhr/xhr.transport.ts) — транспорт на основе `XMLHttpRequest`.

Передавайте один и тот же экземпляр транспорта в `SessionManager` и `RciManager`, чтобы запросы
`RciManager` выполнялись в рамках авторизованной HTTP-сессии:

```typescript
import {RciManager, SessionManager, XHRTransport} from '@rci-tools/core';

const transport = new XHRTransport();
const sessionManager = new SessionManager('http://192.168.1.1', transport);
const rciManager = new RciManager('http://192.168.1.1', transport);
```

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
  loginDetailed(username: string, password: string): Observable<LoginDetails>;
  logout(): Observable<unknown>;

  getRealmHeader(): Observable<string | null>;
  toggleErrorLogging(isEnabled: boolean): void;
}
```

Используйте методы `isAuthenticated`/`login`/`logout` для управления сессией.
Оставшиеся два метода предназначены для вспомогательных задач:

- `getRealmHeader`: позволяет получить имя устройства до аутентификации (например, чтобы показать
  его на экране входа)
- `toggleErrorLogging`: включает/отключает логирование HTTP-ошибок в консоль

По умолчанию `SessionManager` использует первый протокол аутентификации, который предлагает устройство,
и предпочитает `'x-ndw4-interactive'` протоколу `'x-ndw2-interactive'`; после неудачи он никогда
не переключается на другой протокол. Чтобы ограничить набор протоколов или изменить их порядок,
передайте их в конструктор:

```typescript
import {AUTH_PROTOCOL, SessionManager} from '@rci-tools/core';

const sessionManager = new SessionManager('http://192.168.1.1', transport, {
  protocols: [AUTH_PROTOCOL.NDW2], // в порядке предпочтения
});
```

Если устройство не предлагает ни одного из разрешенных протоколов, вход завершается с `'unavailable'`.

`loginDetailed` использует ту же попытку входа, что и `login` (одновременные вызовы любого
из методов приводят к одному обмену с устройством), но возвращает `LoginDetails`:
`{success: true, protocol}` или `{success: false, reason, protocol}`.

`protocol` (`AUTH_PROTOCOL.*`) — протокол, выбранный по challenge устройства (ответу на `GET /auth`):
`'x-ndw4-interactive'` или `'x-ndw2-interactive'`. Выбранный протокол возвращается при любом дальнейшем
исходе, даже если вход не удался до отправки логина и пароля. `null` — протокол не выбран: сессия
уже была, или в ответе нет подходящего challenge (сетевая ошибка, неожиданный HTTP-код,
устройство не предлагает ни одного из разрешенных протоколов).

`reason` (`LOGIN_FAILURE_REASON.*`):

- `'rejected'`: устройство отклонило логин/пароль; повторять попытку с тем же паролем бессмысленно;
- `'unavailable'`: обмен не удалось завершить (устройство выключается, загружается, недоступно
  или ответило что-то неожиданное); имеет смысл повторить попытку позже.

Чтобы ограничить время попытки, используйте собственный таймаут и отпишитесь: дальнейшие запросы
не отправляются, а следующий вызов начинает обмен заново (встроенные транспорты также прерывают
уже отправленный HTTP-запрос).

Если ваш код сам повторяет вход (например, с сохраненным паролем), учитывайте, что в устройства встроена
защита от перебора пароля: после слишком большого числа неудачных попыток входа клиент может быть
временно заблокирован. Ограничивайте число `'rejected'` подряд и делайте паузы после **любой** неудачи,
а не только после `'rejected'`.

### Собственный HTTP-транспорт

Реализуйте [`HttpTransport`](./src/transport/http.transport.ts) для своего типа ответа.
Нужны методы `get`, `post`, `delete`, `getHeader`, `onAuthRequest` и `clearAuthData`.

Что требуется от транспорта:

- запрос отправляется только при подписке на Observable, а при отписке прерывается;
- успешным считается любой ответ со статусом 2xx;
- любой неудачный запрос завершается ошибкой `RciHttpError` (см. ниже);
- `getHeader()` возвращает `null`, если такого заголовка в ответе нет;
- поток `authError$` можно не делать. Если он есть, он сообщает об HTTP 401 вне входа,
  то есть об истёкшей сессии.

Таймаут запросов `execute()` и `queue()` добавляет core, а не транспорт: по умолчанию 60 секунд,
значение задаётся через `RciManagerOptions.requestTimeout`. При срабатывании приходит RxJS `TimeoutError`,
а не `RciHttpError`.

У `RciHttpError` три поля:

- `status` — HTTP-статус ответа; `null`, если ответа не было (например, нет сети);
- `response` — ответ транспорта, если он был: в `response.data` лежит разобранное тело ответа с ошибкой.
  Иначе `null`;
- `cause` — исходная ошибка, например ошибка `fetch`.

Проверяйте ошибку функцией `isRciHttpError(error)`, а не через `instanceof`. В приложении могут оказаться
две копии `@rci-tools/core`, например одна у транспорта, другая у приложения. `instanceof` не узнаёт ошибку
из другой копии, а `isRciHttpError()` узнаёт: проверка опирается на общую метку `Symbol.for`.

`AuthErrorHandler` помогает сделать `authError$`. Его RxJS-оператор `handleAuthError()` смотрит на ошибки
запросов. Если это `RciHttpError` со статусом 401 и события не приостановлены, он отправляет событие
в `authError$`. Сама ошибка после этого идёт дальше без изменений. Другие методы:

- `suspend()` и `resume()` приостанавливают и возобновляют события. Вызовы можно вкладывать:
  события вернутся после последнего `resume()`;
- `AuthErrorHandler.is401Error(error)` проверяет, что это `RciHttpError` со статусом 401;
- `destroy()` завершает `authError$`.

Передайте обработчик в свойство `authErrorSuspension`.
Во время входа `SessionManager` вызывает `suspend()`, а в `finalize` — `resume()`.
HTTP 401 от запроса входа не считается истёкшей сессией.
Это свойство в `HttpTransport` необязательно.

```typescript
import {
  AuthErrorHandler,
  RciHttpError,
  RciManager,
  SessionManager,
  isRciHttpError,
  type AuthErrorSuspension,
  type BaseHttpResponse,
  type HttpTransport,
} from '@rci-tools/core';
import {catchError, throwError, type Observable} from 'rxjs';
import {fromFetch} from 'rxjs/fetch';

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
    return this.request(
      url,
      {
        method: 'POST',
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      },
    );
  }

  public delete(url: string): Observable<CustomResponse> {
    return this.request(url, {method: 'DELETE'});
  }

  public getHeader(response: CustomResponse, name: string): string | null {
    return response.headers.get(name);
  }

  public onAuthRequest(): void {}

  public clearAuthData(): void {}

  // `fromFetch` отправляет запрос при подписке и прерывает его при отписке
  private request(url: string, init: RequestInit = {}): Observable<CustomResponse> {
    return fromFetch(
      url,
      {
        ...init,
        selector: async (response): Promise<CustomResponse> => {
          const text = await response.text();
          let data: unknown = {};

          try {
            data = JSON.parse(text);
          } catch {
            // не JSON, например HTML-страница ошибки
          }

          const result: CustomResponse = {status: response.status, headers: response.headers, data};

          if (!response.ok) {
            throw new RciHttpError(`HTTP ${response.status}`, {status: response.status, response: result});
          }

          return result;
        },
      },
    )
      .pipe(
        // нет HTTP-ответа: ошибка сети или чтения тела
        catchError((cause: unknown) =>
          throwError(() =>
            isRciHttpError(cause) ? cause : new RciHttpError('Network request failed', {status: null, cause})
          )
        ),
        this.authHandler.handleAuthError<CustomResponse>(),
      );
  }
}

const host = 'http://192.168.1.1';
const transport = new CustomHttpTransport();
const sessionManager = new SessionManager(host, transport);
const rciManager = new RciManager(host, transport);

transport.authError$.subscribe(() => console.warn('Сессия истекла'));
```

Встроенные `FetchTransport` и `XHRTransport` тоже предоставляют `authError$`. Так же делает `AxiosTransport`
из пакета `@rci-tools/adapter-axios`.
Приложение может подписаться на него, чтобы узнать об истёкшей сессии. Сам пакет на `authError$`
не подписывается.

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

  // `T` можно не указывать: тогда тип результата берётся из запросов, см. «Типизированные запросы»
  execute<T extends object>(query: RciQuery<QueryPath>): Observable<T | undefined>;
  execute<T extends object>(query: readonly RciQuery<QueryPath>[]): Observable<Array<T | undefined>>;
  queue<T extends object>(query: RciQuery<QueryPath>, options?: QueueOptions): Observable<T | undefined>;
  queue<T extends object>(query: readonly RciQuery<QueryPath>[], options?: QueueOptions): Observable<Array<T | undefined>>;

  initBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundProcessOptions): RciBackgroundProcess;
  queueBackgroundProcess(query: RciQuery<BackgroundQueryPath>, options?: RciBackgroundProcessOptions): RciBackgroundProcess;

  destroy(): void;
}
```

#### `RciManagerOptions`

```typescript
interface RciManagerOptions {
  batchTimeout?: number;           // окно сбора батча в мс; по умолчанию 20, 0 — отправить сразу
  batchScheduler?: BatchScheduler; // переопределение; по умолчанию TimerScheduler
  requestTimeout?: number;         // мс на HTTP-запрос; по умолчанию 60000, 0 — без таймаута
}
```

Время указывается в миллисекундах. `batchTimeout` и `requestTimeout` должны быть конечными числами
от 0 до 2147483647 (наибольшая задержка `setTimeout`); иначе конструктор `RciManager` выбрасывает `RangeError`.
Менеджер читает эти опции один раз при создании.

Дополнительные члены класса:

- `stats$`: выдаёт объект `QueryStats` для каждого завершённого батча, если сбор статистики включён.
  См. [Статистика запросов](./docs/QUEUE.ru.md#статистика-запросов).
- `toggleStats(enabled)`: включает или отключает сбор статистики.
- `replaceBatchScheduler(scheduler, options?)`: заменяет планировщик батчей во время выполнения,
  дожидаясь, пока текущий батч освободится. `options.waitIdleFor` по умолчанию `30000` мс.
  Выбрасывает `SchedulerReplacementInProgressError`, если другая замена уже выполняется.
  См. [Планировщик](./docs/SCHEDULING.ru.md).
- `destroy()`: освобождает внутренние очереди, очереди фоновых процессов и сборщик статистики.
  Ожидающие результаты `queue()` завершаются ошибкой `QueueDestroyedError`. После `destroy()` подписка на
  Observable из `execute()`, `queue()` и `replaceBatchScheduler()` завершается ошибкой
  `RciManagerDestroyedError`, даже если Observable получен до `destroy()`;
  `initBackgroundProcess()` и `queueBackgroundProcess()` выбрасывают её.
  Процессы, созданные через `initBackgroundProcess()`, принадлежат вызывающему коду и не уничтожаются.
  Транспортом менеджер тоже не владеет. Повторный вызов `destroy()` ничего не делает.

`T` в `execute()`/`queue()` — утверждение типа, а не проверка во время выполнения. Элемент равен
`undefined`, если в ответе устройства нет значения по пути запроса.

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
  saveConfiguration?: boolean; // добавить запрос system/configuration/save; его ответ не возвращается. По умолчанию: false
}
```

`saveConfiguration` не меняет форму результата: одиночный запрос выдаёт одно значение, массив из N запросов — массив
из N элементов. Запрос сохранения всегда отправляется последним в своём пакете, поэтому сохраняет и изменения других
задач этого пакета. Если нужен ответ запроса сохранения, добавьте его в массив сами — как обычный запрос со своим
элементом в результате:

```typescript
rciManager.queue([
  {path: 'system.description', data: 'Home'},
  {path: 'system.configuration.save'},
]); // выдаёт [descriptionResult, saveResult]
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
  Каждая подписка отправляет свой запрос; отписка до получения ответа прерывает его
  (встроенные транспорты). Вы полностью контролируете жизненный цикл подписки. Это может быть полезно, если нужно:
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
Если HTTP-запрос не удался или ответ на батч не является массивом, Observable завершается ошибкой
`RciHttpError`. Если ответ не пришёл за `requestTimeout` (по умолчанию 60 секунд), будет ошибка RxJS `TimeoutError`.

#### Типизированные запросы

`TypedRciQuery<T>` — это обычный `RciQuery`, к которому привязан тип ответа `T`. Тип указывается один раз, когда
объявляется запрос. Дальше `queue()` и `execute()` сами знают, что вернётся, и писать `queue<T>()` или `as` не нужно:

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

- Если передать массив прямо в вызове, `queue([a, b])`, результат будет кортежем: свой тип для каждого запроса,
  в том же порядке. Для обычного `RciQuery` на его месте будет `GenericObject | undefined`. Если массив собран
  заранее (`RciQuery[]`), результат, как и раньше, — `Array<GenericObject | undefined>`.
- Тип ответа ничего не проверяет во время выполнения: это обещание компилятору, как и `T` в `queue<T>()`.
- Если указать тип результата явно (`queue<T>()`, `as` или тип переменной), он заменит тип из запросов. Для `queue<T>()`
  с массивом результат — `Array<T | undefined>`, как и раньше. Для `as` и типа переменной длина кортежа должна
  совпадать с числом запросов, иначе будет ошибка компиляции.
- При `extractData: false` тип `T` должен описывать весь ответ, а не только значение по пути запроса.
- Если в `RciManager` список допустимых путей ограничен (`QueryPath`), передайте его вторым параметром. Удобно завести
  короткий алиас: `type Query<T> = TypedRciQuery<T, MyQueryPath>`. Без второго параметра у запроса путь — любая
  строка, и такой менеджер его не примет.
- Тип ответа хранится в свойстве `'~response'`, которое есть только в типах. В самих объектах запросов его задавать
  не нужно.

#### Пакетное планирование (Batch Scheduling)

По умолчанию `queue()` объединяет запросы в батчи с окном 20мс перед отправкой одного
HTTP-запроса. Это поведение управляется **планировщиком (scheduler)** — настройте его через
`RciManagerOptions.batchScheduler` или замените во время выполнения с помощью
`replaceBatchScheduler()`.

Подробнее: см., встроенные [планировщики](./docs/SCHEDULING.ru.md)
(`TimerScheduler`, `RuleScheduler`, `raceSchedulers`), интерфейс `BatchSnapshot`, примеры
пользовательских планировщиков и замена во время выполнения.

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

    const changeSettingResult = await firstValueFrom(rciManager.queue(changeHomeDescription)); // объект со статусом выполнения команды

    // соответствующее действие (настройка с префиксом 'show.rc')
    const readInterfaceDescription: RciQuery = {
      path: 'show.rc.interface.description', // чтение из "running-config"
      data: {name: 'Bridge0'},
    };

    const readSettingResult = await firstValueFrom(rciManager.queue(readInterfaceDescription)); // 'My awesome home network'

    // другое действие
    const showVersion: RciQuery = { // data по умолчанию {}
      path: 'show.version',
    };

    const actionResult = await firstValueFrom(rciManager.queue(showVersion)); // объект с информацией о версии устройства

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

#### Использование `RciQueue` отдельно

`RciManager` внутри содержит два экземпляра `RciQueue` (батчинг-очередь и приоритетную очередь).
Если вам нужен только батчинг, вы можете использовать `RciQueue` напрямую — без `RciManager`.

Подробнее: [`RciQueue` отдельно](./docs/QUEUE.ru.md) — полный API, опции конструктора, отличия
от `RciManager` и примеры, включая воспроизведение приоритетной системы с двумя очередями.

#### Фоновые процессы

Для [фоновых процессов](../../docs/RCI_API.ru.md#23-фоновые-процессы) `RciManager`
предоставляет два метода, также принимающих объекты `RciQuery`
и дополнительные настройки:

```typescript
interface RciBackgroundProcessOptions {
  pollInterval?: number; // интервал между GET-запросами в мс. По умолчанию: 1000
  timeout?: number;      // мс до отправки DELETE для остановки процесса. По умолчанию: 0 (без таймаута)
}
```

Время указывается в миллисекундах; все значения должны быть конечными числами. `pollInterval` должен быть больше 0,
`timeout` — не меньше 0, и оба не больше 2147483647. При неверных значениях `initBackgroundProcess()`
и `queueBackgroundProcess()` выбрасывают `RangeError`.

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
- `abort(): boolean`: Отправляет `DELETE` к ресурсу команды RCI и прерывает локальный процесс.
  Процесс, ещё ожидающий в очереди `queueBackgroundProcess()`, до устройства не дошёл:
  он завершается локально с `ABORTED` (`DELETE` не отправляется), очередь его пропускает.
  В остальных состояниях возвращает `false`.
- `state$`: Observable, который выдаёт изменения состояния процесса (`RCI_BACKGROUND_PROCESS_STATE`)
- `data$`: Observable, который выдаёт обновления данных по мере выполнения фонового процесса
- `result$`: Observable, который выдаёт финальный результат один раз, непосредственно перед
  завершением процесса.
  Не выдаёт значения при прерывании или таймауте.
- `done$`: Observable, который выдаёт значение по завершении процесса (
  `RCI_BACKGROUND_PROCESS_FINISH_REASON`), после чего завершается
- `error: unknown`: Ошибка, которой завершился процесс с `ERROR` (`done$` выдаёт
  `RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR`); `null` при любом другом исходе и пока процесс выполняется.
  Значение устанавливается до того, как `done$` выдаст причину, и остаётся доступным после `destroy()`.
  Если не удался HTTP-запрос, здесь будет `RciHttpError` (`status` равен `null`, если ответа не было).
  Срабатывание опции `timeout` — не ошибка: процесс завершается с причиной `TIMED_OUT`, а `error` остаётся `null`.
  Ошибки, которые устройство сообщает внутри успешного ответа (записи `status` в ответе RCI), не завершают
  процесс с `ERROR`: они приходят в `data$` / `result$`.
- `destroy(): void`: Освобождает локальные ресурсы: останавливает опрос, прерывает текущий HTTP-запрос
  и завершает все потоки (`done$` завершается без значения). Процесс на устройстве **не** останавливается;
  если это нужно, сначала вызовите `abort()`. Уничтоженный процесс больше не блокирует свою очередь
  `queueBackgroundProcess()`.

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

Чтобы узнать, почему процесс завершился с ошибкой:

```typescript
process.done$.subscribe((reason) => {
  if (reason === RCI_BACKGROUND_PROCESS_FINISH_REASON.ERROR) {
    console.warn(`${process.command} failed`, process.error);
  }
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

Когда сбор статистики включён через `toggleStats(true)`, `stats$` выдаёт объект `QueryStats`
для каждого завершённого батча. См. [Статистика запросов](./docs/QUEUE.ru.md#статистика-запросов)
— полный интерфейс `QueryStats` и использование с отдельным `RciQueue`.
