**English** | [Русский](AUTH.ru.md)

# Password-based authentication

To authenticate your HTTP session on a Keenetic/Netcraze device
using username and password you need to do the following:

1. Ask the device for a session and find out which authentication schema it offers
2. Complete the handshake of that schema

There are two schemas:

- [`x-ndw2-interactive`](#step-2-x-ndw2-interactive) &mdash; a single hashed password sent in response to a challenge
- [`x-ndw4-interactive`](#step-2-x-ndw4-interactive) &mdash; a SCRAM-SHA3-512 handshake with Argon2id key derivation

If the device advertises both, prefer `x-ndw4-interactive`.

## Step 1: request a session

1. Send a GET request to `<KINETIC_ADDRESS>/auth`
    - If the response contains HTTP code 200:
        - Either you are already authenticated
        - Or the `admin` password is not set  

      In either case set the session cookie using the `Set-Cookie` header
      from the response -> the session is authenticated.

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

    - If the response contains HTTP code 401 (`Unauthorized`),
      set the session cookie using the `Set-Cookie` header and pick the authentication
      schema from the `WWW-Authenticate` header:

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

      A device that supports several schemas lists them in the same header,
      separated by commas (schematically):

        ```
        WWW-Authenticate: x-ndw4-interactive realm="<realm>" endpoint="<path>", x-ndw2-interactive realm="<realm>" challenge="<token>" session_id="<id>" session_cookie="<name>"
        ```

## Step 2: `x-ndw2-interactive`

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

## Step 2: `x-ndw4-interactive`

This schema is a [SCRAM](https://en.wikipedia.org/wiki/Salted_Challenge_Response_Authentication_Mechanism)
handshake built on SHA3-512 and [Argon2id](https://en.wikipedia.org/wiki/Argon2):
the password itself never leaves the client, and the device has to prove that it knows
the password as well (mutual authentication).

Every phase is a POST request with a plain JSON body sent to the endpoint taken from
the `endpoint="..."` parameter of the `x-ndw4-interactive` chunk of the `WWW-Authenticate`
header (`<KINETIC_ADDRESS><endpoint>`). The device replies with a base64-encoded JSON object
in the `X-NDM-Data` **response header** &mdash; the body of the reply is not used.
The replies of the first two phases come with a non-200 HTTP code, which is expected;
only the last one is a 200.

A reply that contains a non-empty `error` (or `e`) field is a failure: report it and stop.

2. **Phase 1** &mdash; ask for the challenge.

   Generate a client nonce (16 random bytes, base64-encoded) and send:
        ```
        {
          login: username,
          nonce: clientNonce
        }
        ```

   The reply contains the Argon2id parameters:
        ```
        {
          salt: <base64, exactly 16 bytes>,
          nonce: <base64, client nonce + server nonce>,
          iter: <iterations, 1..64>,
          memcost: <memory cost in KiB, 8..262144>
        }
        ```

    - `nonce` must start with the client nonce sent above, otherwise abort
    - `iter` and `memcost` are sent either as numbers or as decimal strings

   Build the `AuthMessage` that the following phases sign
   (using the **raw** `iter`/`memcost` values, exactly as they were received):
        ```
        login1=<username>,nonce1=<clientNonce>;iter2=<iter>,memcost2=<memcost>,nonce2=<nonce>,salt2=<salt>;login3=<username>,nonce3=<nonce>
        ```

3. Derive the keys (Argon2id replaces the PBKDF2-based `Hi()` of RFC 5802):
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

   A proof of any message is calculated as:
       ```
       const proof = (message) => base64(clientKey XOR hmacSha3_512(storedKey, message));
       ```

4. **Phase 2** &mdash; send the client proof:
        ```
        {
          login: username,
          nonce: <combined nonce from phase 1>,
          proof: proof(authMessage)
        }
        ```

   The reply contains the server signature:
        ```
        {
          signature: <base64>
        }
        ```

   Verify it against `hmacSha3_512(serverKey, authMessage)`.
   If the signatures do not match, the device does not know the password:
   abort without sending the last phase.

5. **Phase 3** &mdash; confirm the verified signature:
        ```
        {
          login: username,
          nonce: <combined nonce from phase 1>,
          'signature-proof': proof(authMessage + ';signature4=' + signature)
        }
        ```

    - If the response contains code 200 -> the session is authenticated
      (`SessionManager` re-checks it with a GET request to `<KINETIC_ADDRESS>/auth`)
    - If the response contains a different HTTP code, the authentication has failed

## Miscellaneous

The HTTP session lasts 10 minutes (i.e., if no requests are sent within 10 minutes,
you will have to authenticate again).

There is [a `bash` function](ndw2_auth_fn.sh) that you can call to try
the `x-ndw2-interactive` algorithm described above.
The function assumes that the following binaries are available:
- `curl`
- `jq`
- `md5`
- `shasum`

Usage:
```bash
source ndw2_auth_fn.sh

ndw2_auth --username <username> --password <password> [--addr <address>]
```

Both schemas can also be tried against a real device with the scripts from `packages/core`
(they prompt for the address and the credentials):

```bash
pnpm test:ndw2-auth
pnpm test:ndw4-auth
```
