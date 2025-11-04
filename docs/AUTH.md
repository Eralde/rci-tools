**English** | [Русский](AUTH_RU.md)

# Password-based authentication

To authenticate your HTTP session on a Keenetic/Netcraze device
using username and password you need to do the following:

1. Send a GET request to `<KINETIC_ADDRESS>/auth`
    - If the response contains HTTP code 200:
        - Either you are already authenticated
        - Or the `admin` password is not set  

      In either case set the session cookie using the `Set-Cookie` header
      from the response -> the session is authenticated

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

    - If the response contains HTTP code 401 (`Unauthorized`),
      set the session cookie using the `Set-Cookie` header and proceed to step 2:

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

2. Save the following headers from the 401 response:
    - `X-NDM-Challenge` (`token`)
    - `X-NDM-Realm` (`realm`)

   Calculate the hashed password:
       ```
       const hashedPassword = sha256(token + md5(login + ':' + realm + ':' + password));
       ```

   Send a POST request to the same address (`<KINETIC_ADDRESS>/auth`),
   with the `Content-Type: application/json` header and the following JSON as body:
        ```
        {
          login: username,
          password: hashedPassword
        }
        ```
    - If the response contains code 200 -> the session is authenticated
    - If the response contains a different HTTP code, check that the password has been passed correctly
      and try again.

The HTTP session lasts 10 minutes (i.e., if no requests are sent within 10 minutes,
you will have to authenticate again).

There is [a `bash` function](./password_auth_fn.sh) that you can call to try the algorithm described above.
The function assumes that the following binaries are available:
- `curl`
- `jq`
- `md5`
- `shasum`

Usage:
```bash
source password_auth_fn.sh

password_auth --username <username> --password <password> [--addr <address>]
```
