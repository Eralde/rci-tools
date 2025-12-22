[English](AUTH.md) | **Русский**

# Аутентификация по паролю

Чтобы аутентифицировать HTTP-сессию на устройстве Keenetic/Netcraze
с помощью имени пользователя и пароля, выполните следующие действия:

1. Отправьте GET-запрос на `<KINETIC_ADDRESS>/auth`
    - Если ответ содержит HTTP-код 200:
        - Либо вы уже аутентифицированы
        - Либо пароль пользователя `admin` не установлен  

      В любом случае установите cookie сессии из заголовка `Set-Cookie` в ответе
      -> аутентификация завершена

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
      установите cookie сессии из заголовка `Set-Cookie` и переходите к шагу 2:

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

HTTP-сессия длится 10 минут (т.е., если в течение 10 минут не отправлять запросы,
потребуется повторная аутентификация).

В файле [password_auth_fn.sh](./password_auth_fn.sh) приведен пример функции на `bash`,
которая выполняет аутентификацию с помощью описанного выше алгоритма.
Функция предполагает наличие следующих бинарных файлов:

- `curl`
- `jq`
- `md5`
- `shasum`

Использование:
```bash
source password_auth_fn.sh

password_auth --username <username> --password <password> [--addr <address>]
```
