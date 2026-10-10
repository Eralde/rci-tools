[English](AUTH.md) | **Русский**

# Аутентификация по паролю

Чтобы аутентифицировать HTTP-сессию на устройстве Keenetic/Netcraze
с помощью имени пользователя и пароля, выполните следующие действия:

1. Запросите сессию у устройства и узнайте, какие схемы аутентификации оно предлагает
2. Выполните рукопожатие для выбранной схемы

На данный момент доступно две схемы:

- [`x-ndw2-interactive`](#шаг-2-x-ndw2-interactive) &mdash; простой challenge <-> response с хешированным паролем
- [`x-ndw4-interactive`](#шаг-2-x-ndw4-interactive) &mdash; рукопожатие SCRAM-SHA3-512 с формированием ключей через Argon2id

Если устройство предлагает обе схемы, предпочтительна `x-ndw4-interactive`.

## Шаг 1: запрос сессии

1. Отправьте GET-запрос на `<KINETIC_ADDRESS>/auth`
    - Если ответ содержит HTTP-код 200:
        - Либо вы уже аутентифицированы
        - Либо пароль пользователя `admin` не установлен  

      В любом случае установите cookie сессии из заголовка `Set-Cookie` в ответе
      -> аутентификация завершена.

      `curl -i http://192.168.1.1/auth`

        ```shell
        > curl -i http://192.168.1.1/auth
        HTTP/1.1 200 OK
        Server: Web server
        Date: Thu, 01 Jan 1970 03:14:27 GMT
        Content-Length: 33
        Connection: keep-alive
        Set-Cookie: SEKLGYBCRCTC=ZHIBHDARYLUXTWQF; Path=/; SameSite=Lax; Max-Age=300
        Expires: Thu, 01 Jan 1970 03:14:26 GMT
        Cache-Control: no-cache
        Cache-Control: private
        Cache-Control: must-revalidate
        X-Frame-Options: DENY
        Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-hashes' 'unsafe-inline'; script-src-attr 'self' 'unsafe-inline' 'unsafe-hashes'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes'; style-src-elem 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes'; base-uri 'self'; form-action 'self';
        Referrer-Policy: strict-origin-when-cross-origin
        ```

    - Если ответ содержит HTTP-код 401 (`Unauthorized`),
      установите cookie сессии из заголовка `Set-Cookie` и выберите схему
      аутентификации по заголовку `WWW-Authenticate`:

      `curl -i http://192.168.1.1/auth`

        ```shell
        > curl -i http://192.168.1.1/auth
        HTTP/1.1 401 Unauthorized
        Server: Web server
        Date: Tue, 21 Oct 2025 17:36:03 GMT
        Transfer-Encoding: chunked
        Connection: keep-alive
        Set-Cookie: ICNYEPYFESWFL=QYGTYZSROQLOELYE; Path=/; SameSite=Lax; Max-Age=300
        X-Ndm-Product: Hopper
        X-Ndm-IspLock: true
        WWW-Authenticate: x-ndw2-interactive realm="Keenetic Hopper" challenge="NZTNNJVJEGJSTRGZFKWSGCNINRIAVVRO" session_id="QYGTYZSROQLOELYE" session_cookie="ICNYEPYFESWFL"
        X-NDM-Realm: Keenetic Hopper
        X-NDM-Challenge: NZTNNJVJEGJSTRGZFKWSGCNINRIAVVRO
        ```

      Устройство, поддерживающее несколько схем, перечисляет их в одном заголовке
      через запятую (схематично):

        ```
        WWW-Authenticate: x-ndw4-interactive realm="<realm>" endpoint="<path>", x-ndw2-interactive realm="<realm>" challenge="<token>" session_id="<id>" session_cookie="<name>"
        ```

## Шаг 2: `x-ndw2-interactive`

2. Сохраните следующие заголовки из ответа с кодом 401:
    - `X-NDM-Challenge` (`token`)
    - `X-NDM-Realm` (`realm`)

   Вычислите хешированный пароль:
       ```
       const hashedPassword = sha256(token + md5(login + ':' + realm + ':' + password));
       ```

   Отправьте POST-запрос на тот же адрес (`<KINETIC_ADDRESS>/auth`),
   с заголовком `Content-Type: application/json` и следующим JSON в качестве тела запроса:
        ```
        {
          login: username,
          password: hashedPassword
        }
        ```
    - Если ответ содержит код 200 -> сессия аутентифицирована
    - Если ответ содержит другой HTTP-код, проверьте правильность передачи пароля и повторите попытку.

## Шаг 2: `x-ndw4-interactive`

Эта схема представляет собой рукопожатие
[SCRAM](https://ru.wikipedia.org/wiki/SCRAM), построенное на SHA3-512 и
[Argon2id](https://ru.wikipedia.org/wiki/Argon2): сам пароль никогда не покидает клиента,
а устройство, в свою очередь, обязано доказать, что знает пароль (взаимная аутентификация).

Каждая фаза &mdash; это POST-запрос с обычным JSON в теле, отправляемый на адрес из параметра
`endpoint="..."` той части заголовка `WWW-Authenticate`, которая относится
к схеме `x-ndw4-interactive` (`<KINETIC_ADDRESS><endpoint>`). Устройство отвечает
JSON-объектом в кодировке base64 в **заголовке ответа** `X-NDM-Data` &mdash; тело ответа не используется.
Ответы первых двух фаз приходят с HTTP-кодом, отличным от 200, &mdash; это ожидаемо;
код 200 приходит только в последней фазе.

Ответ, содержащий непустое поле `error` (или `e`), означает ошибку:
сообщите о ней и прервите аутентификацию.

2. **Фаза 1** &mdash; запрос challenge.

   Сгенерируйте клиентский nonce (16 случайных байт в кодировке base64) и отправьте:
        ```
        {
          login: username,
          nonce: clientNonce
        }
        ```

   Ответ содержит параметры Argon2id:
        ```
        {
          salt: <base64, ровно 16 байт>,
          nonce: <base64, клиентский nonce + серверный nonce>,
          iter: <число итераций, 1..64>,
          memcost: <объем памяти в КиБ, 8..262144>
        }
        ```

    - `nonce` должен начинаться с отправленного выше клиентского nonce, иначе прервите аутентификацию
    - `iter` и `memcost` передаются либо числами, либо десятичными строками

   Составьте `AuthMessage`, который подписывается в следующих фазах
   (используя **исходные** значения `iter`/`memcost`, ровно в том виде, в котором они получены):
        ```
        login1=<username>,nonce1=<clientNonce>;iter2=<iter>,memcost2=<memcost>,nonce2=<nonce>,salt2=<salt>;login3=<username>,nonce3=<nonce>
        ```

3. Вычислите ключи (Argon2id используется вместо функции `Hi()` на основе PBKDF2 из RFC 5802):
       ```
       const saltedPassword = argon2id({
         password, salt,
         iterations: iter,
         memorySize: memcost,
         parallelism: 1,
         hashLength: 64
       });

       const clientKey = hmacSha3_512(saltedPassword, 'NDW4 Interactive Client Key');
       const storedKey = sha3_512(clientKey);
       const serverKey = hmacSha3_512(saltedPassword, 'NDW4 Interactive Server Key');
       ```

   Доказательство (proof) произвольного сообщения вычисляется так:
       ```
       const proof = (message) => base64(clientKey XOR hmacSha3_512(storedKey, message));
       ```

4. **Фаза 2** &mdash; отправка клиентского доказательства:
        ```
        {
          login: username,
          nonce: <объединенный nonce из фазы 1>,
          proof: proof(authMessage)
        }
        ```

   Ответ содержит подпись сервера:
        ```
        {
          signature: <base64>
        }
        ```

   Сверьте ее с `hmacSha3_512(serverKey, authMessage)`.
   Если подписи не совпадают, подпись вычислена не из того пароля, который использовал клиент:
   прервите аутентификацию, не отправляя последнюю фазу.

5. **Фаза 3** &mdash; подтверждение проверенной подписи:
        ```
        {
          login: username,
          nonce: <объединенный nonce из фазы 1>,
          'signature-proof': proof(authMessage + ';signature4=' + signature)
        }
        ```

    - Если ответ содержит код 200 -> сессия аутентифицирована
      (`SessionManager` дополнительно проверяет это GET-запросом на `<KINETIC_ADDRESS>/auth`)
    - Если ответ содержит другой HTTP-код, аутентификация не удалась

## Разное

HTTP-сессия длится 10 минут (т.е., если в течение 10 минут не отправлять запросы,
потребуется повторная аутентификация).

В файле [ndw2_auth_fn.sh](ndw2_auth_fn.sh) приведен пример функции на `bash`,
которая выполняет аутентификацию по описанному выше алгоритму `x-ndw2-interactive`.
Функция предполагает наличие следующих бинарных файлов:

- `curl`
- `jq`
- `md5`
- `shasum`

Использование:
```bash
source ndw2_auth_fn.sh

ndw2_auth --username <username> --password <password> [--addr <address>]
```

Обе схемы также можно проверить на реальном устройстве с помощью скриптов
из `packages/core` (они запрашивают адрес и учетные данные):

```bash
pnpm test:ndw2-auth
pnpm test:ndw4-auth
```
