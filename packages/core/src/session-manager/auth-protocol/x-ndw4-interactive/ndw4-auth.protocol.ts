import {argon2id} from 'hash-wasm';
import {Observable, defer, of} from 'rxjs';
import {catchError, exhaustMap, map} from 'rxjs/operators';
import type {BaseHttpResponse, HttpTransport} from '../../../transport/http.transport';
import {AUTH_PROTOCOL, LOGIN_FAILURE_REASON} from '../auth-protocol.types';
import type {LoginResult, SessionAuthContext, SessionAuthProtocol} from '../auth-protocol.types';
import {checkFinalLoginResult, toLoginFailure} from '../login-result.utils';
import {decodeBase64, encodeBase64, equalBytes, hmacSha3_512, sha3_512} from './ndw4-auth.utils';
import {
  NDW4_CLIENT_KEY,
  NDW4_HASH_LENGTH,
  NDW4_MAX_ITERATIONS,
  NDW4_MAX_MEMORY_KIB,
  NDW4_MIN_MEMORY_KIB,
  NDW4_PARALLELISM,
  NDW4_REPLY_HEADER,
  NDW4_SALT_LENGTH,
  NDW4_SERVER_KEY,
} from './ndw4-auth.constants';
import {
  Ndw4Challenge,
  Ndw4ClientHandshake,
  Ndw4FirstReply,
  Ndw4Keys,
  Ndw4SecondReply,
  Ndw4Secrets,
  Ndw4ServerReply,
  Ndw4ServerSignature,
} from './ndw4-auth.types';

/**
 * The device has refused the credentials:
 * - the phase 2 server signature does not match the password the client used;
 * - a non-empty `error` / `e` in a reply.
 */
class Ndw4RejectedError extends Error {
}

/**
 * SCRAM-SHA3-512 (Argon2id variant) auth over a JSON / X-NDM-Data transport.
 *
 * @see https://en.wikipedia.org/wiki/Salted_Challenge_Response_Authentication_Mechanism (SCRAM)
 * @see https://en.wikipedia.org/wiki/Argon2 (Argon2 / Argon2id)
 *
 * The SCRAM values (nonce, salt, proof, signature) are carried as named JSON fields:
 * the client POSTs a plain JSON body, and the server returns its reply
 * as a base64-encoded JSON object inside the "X-NDM-Data" response header.
 *
 * The handshake is three [request + reply] phases:
 *
 *       Phase 1 : POST body   {"login": <user>, "nonce": <base64(16-byte client nonce)>}
 *                 reply       {"salt": <base64(salt)>, "nonce": <server nonce>, "iter": <n>, "memcost": <KiB>}
 *                 see `requestChallenge()`
 *
 *       Keys    : Argon2id derivation from the phase 1 parameters, see `deriveKeys()`
 *
 *       Phase 2 : POST body   {"login": <user>, "nonce": <server nonce>, "proof": <base64(client proof)>}
 *                 reply       {"signature": <base64(server signature)>}
 *                 see `sendClientProof()`
 *
 *       Phase 3 : POST body   {"login": <user>, "nonce": <server nonce>, "signature-proof": <base64(signature proof)>}
 *                 reply       200 OK
 *                 see `sendSignatureProof()`
 *
 * The AuthMessage signed by the client proof and by the server signature uses
 * the RFC 5802 layout, rebuilt from those JSON fields.
 */
export class Ndw4AuthProtocol<ResponseType extends BaseHttpResponse = BaseHttpResponse>
  implements SessionAuthProtocol<ResponseType> {
  public readonly schema = AUTH_PROTOCOL.NDW4;

  constructor(
    public readonly host: string,
    public readonly httpTransport: HttpTransport<ResponseType>,
  ) {
  }

  public isSupported(response: ResponseType): boolean {
    const header = this.httpTransport.getHeader(response, 'WWW-Authenticate');

    return header.includes(this.schema);
  }

  public authenticate(
    initialResponse: ResponseType,
    context: SessionAuthContext<ResponseType>,
    username: string,
    password: string,
  ): Observable<LoginResult> {
    return defer(() => of(this.createHandshake(initialResponse, username, password)))
      .pipe(
        exhaustMap((handshake) => this.requestChallenge(handshake, context)),
        exhaustMap((challenge) => this.deriveKeys(challenge)),
        exhaustMap((secrets) => this.sendClientProof(secrets, context)),
        exhaustMap((serverSignature) => this.sendSignatureProof(serverSignature, context)),
        catchError((error) => {
          context.logError(error);

          const reason = error instanceof Ndw4RejectedError
            ? LOGIN_FAILURE_REASON.REJECTED
            : LOGIN_FAILURE_REASON.UNAVAILABLE;

          return of(toLoginFailure(reason));
        }),
      );
  }

  /** Phase 1: {login, nonce} -> {salt, nonce, iter, memcost}. */
  private requestChallenge(
    handshake: Ndw4ClientHandshake,
    context: SessionAuthContext<ResponseType>,
  ): Observable<Ndw4Challenge> {
    const requestData = {
      login: handshake.username,
      nonce: handshake.clientNonce,
    };

    return this.exchange(handshake.authUrl, requestData, context)
      .pipe(
        map((reply) => this.toChallenge(handshake, reply)),
      );
  }

  /** Phase 2: {login, nonce, proof} -> {signature}. */
  private sendClientProof(
    secrets: Ndw4Secrets,
    context: SessionAuthContext<ResponseType>,
  ): Observable<Ndw4ServerSignature> {
    return defer(() => this.createProof(secrets.keys, secrets.authMessage))
      .pipe(
        exhaustMap((proof) => {
          const requestData = {
            login: secrets.username,
            nonce: secrets.combinedNonce,
            proof,
          };

          return this.exchange(secrets.authUrl, requestData, context);
        }),
        exhaustMap((reply) => this.verifyServerSignature(secrets, reply)),
      );
  }

  /** Phase 3: {login, nonce, signature-proof} -> 200 OK. */
  private sendSignatureProof(
    serverSignature: Ndw4ServerSignature,
    context: SessionAuthContext<ResponseType>,
  ): Observable<LoginResult> {
    const {keys, signatureBase64} = serverSignature;
    const authMessage = `${serverSignature.authMessage};signature4=${signatureBase64}`;

    return defer(() => this.createProof(keys, authMessage))
      .pipe(
        exhaustMap((signatureProof) => {
          const requestData = {
            login: serverSignature.username,
            nonce: serverSignature.combinedNonce,
            'signature-proof': signatureProof,
          };

          return this.post(serverSignature.authUrl, requestData, context);
        }),
        exhaustMap((response) => {
          // The server signature has matched, so the password is right:
          // a non-200 here is not a password issue (e.g. the device has dropped the handshake state).
          return response.status === 200
            ? checkFinalLoginResult(context)
            : of(toLoginFailure(LOGIN_FAILURE_REASON.UNAVAILABLE));
        }),
      );
  }

  // `throw` inside this method will be caught by the `catchError` tail of `authenticate()`
  private createHandshake(
    initialResponse: ResponseType,
    username: string,
    password: string,
  ): Ndw4ClientHandshake {
    const endpoint = this.getAuthEndpoint(initialResponse);

    if (!endpoint) {
      throw new Error('NDW4 auth failed: no auth endpoint provided.');
    }

    const clientNonce = encodeBase64(this.createNonce());

    return {
      authUrl: `${this.host}${endpoint}`,
      username,
      password,
      clientNonce,
    };
  }

  private getAuthEndpoint(response: ResponseType): string | null {
    const header = this.httpTransport.getHeader(response, 'WWW-Authenticate');
    const chunks = header.split(',');
    const schemaChunk = chunks.find((chunk) => chunk.includes(this.schema));

    if (!schemaChunk) {
      return null;
    }

    const endpoint = schemaChunk.match(/endpoint="([^"]+)"/)?.[1];

    return endpoint ? endpoint : null;
  }

  /** Validates the first reply and builds the AuthMessage every later phase signs. */
  private toChallenge(handshake: Ndw4ClientHandshake, reply: Ndw4FirstReply): Ndw4Challenge {
    this.throwOnReplyError(reply, 'first');

    const {username, clientNonce} = handshake;
    const combinedNonce = this.requireString(reply.nonce, 'nonce');

    if (!combinedNonce.startsWith(clientNonce)) {
      throw new Error('NDW4 auth failed: server nonce does not start with client nonce.');
    }

    const saltBase64 = this.requireString(reply.salt, 'salt');
    const salt = decodeBase64(saltBase64);

    if (salt.length !== NDW4_SALT_LENGTH) {
      throw new Error(`NDW4 auth failed: salt must be exactly ${NDW4_SALT_LENGTH} bytes.`);
    }

    const iterations = this.toCostParameter(reply.iter, 'iter', 1, NDW4_MAX_ITERATIONS);
    const memorySize = this.toCostParameter(
      reply.memcost,
      'memcost',
      NDW4_MIN_MEMORY_KIB,
      NDW4_MAX_MEMORY_KIB,
    );

    // The cost parameters are signed exactly as they were received, not as they were parsed.
    const clientFirst = `login1=${username},nonce1=${clientNonce}`;
    const serverFirst = [
      `iter2=${iterations.raw}`,
      `memcost2=${memorySize.raw}`,
      `nonce2=${combinedNonce}`,
      `salt2=${saltBase64}`,
    ].join(',');
    const clientFinal = `login3=${username},nonce3=${combinedNonce}`;
    const authMessage = `${clientFirst};${serverFirst};${clientFinal}`;

    return {
      ...handshake,
      combinedNonce,
      salt,
      iterations: iterations.value,
      memorySize: memorySize.value,
      authMessage,
    };
  }

  /** Argon2id replaces the PBKDF2-based Hi() of RFC 5802. */
  private async deriveKeys(challenge: Ndw4Challenge): Promise<Ndw4Secrets> {
    const saltedPassword = await argon2id({
      password: challenge.password,
      salt: challenge.salt,
      iterations: challenge.iterations,
      parallelism: NDW4_PARALLELISM,
      memorySize: challenge.memorySize,
      hashLength: NDW4_HASH_LENGTH,
      outputType: 'binary',
    });

    const clientKey = await hmacSha3_512(saltedPassword, NDW4_CLIENT_KEY);

    return {
      ...challenge,
      keys: {
        clientKey,
        storedKey: await sha3_512(clientKey),
        serverKey: await hmacSha3_512(saltedPassword, NDW4_SERVER_KEY),
      },
    };
  }

  private async createProof(keys: Ndw4Keys, authMessage: string): Promise<string> {
    const clientSignature = await hmacSha3_512(keys.storedKey, authMessage);
    const xorResult = this.xorBytes(keys.clientKey, clientSignature);

    return encodeBase64(xorResult);
  }

  /** Mutual authentication: only a server that knows the password can produce this signature. */
  private verifyServerSignature(
    secrets: Ndw4Secrets,
    reply: Ndw4SecondReply,
  ): Observable<Ndw4ServerSignature> {
    return defer(async () => {
      this.throwOnReplyError(reply, 'second');

      const signatureBase64 = this.requireString(reply.signature, 'signature');
      const expectedSignature = await hmacSha3_512(secrets.keys.serverKey, secrets.authMessage);

      if (!equalBytes(decodeBase64(signatureBase64), expectedSignature)) {
        throw new Ndw4RejectedError('NDW4 auth failed: server signature mismatch.');
      }

      return {...secrets, signatureBase64};
    });
  }

  /** A POST request + its decoded X-NDM-Data reply. */
  private exchange(
    authUrl: string,
    data: unknown,
    context: SessionAuthContext<ResponseType>,
  ): Observable<Record<string, unknown>> {
    return this.post(authUrl, data, context)
      .pipe(
        map((response) => this.decodeReply(response)),
      );
  }

  private post(
    authUrl: string,
    data: unknown,
    context: SessionAuthContext<ResponseType>,
  ): Observable<ResponseType> {
    return this.httpTransport.post(authUrl, data)
      .pipe(
        catchError((error) => {
          const response = context.errorToResponse(error);

          // Every reply but the last one is a non-200 response, which the transport throws
          // and `errorToResponse` unwraps, so a response-shaped error is business as usual.
          // Anything else is a transport failure that would otherwise be reported only as a
          // missing X-NDM-Data header, with the original cause lost.
          if (typeof response?.status !== 'number') {
            context.logError(error);
          }

          return of(response);
        }),
      );
  }

  /**
   * The reply is whatever the server chose to send, so it is typed as such:
   * the `Ndw4*Reply` shapes it flows into declare every field as `unknown`,
   * which makes this assignment checked rather than asserted.
   */
  private decodeReply(response: ResponseType): Record<string, unknown> {
    const encodedPayload = this.httpTransport.getHeader(response, NDW4_REPLY_HEADER);

    if (!encodedPayload) {
      throw new Error(`NDW4 auth failed: missing ${NDW4_REPLY_HEADER} header.`);
    }

    const payload = decodeBase64(encodedPayload);
    const json = new TextDecoder().decode(payload);
    const parsed: unknown = JSON.parse(json);

    if (!this.isRecord(parsed)) {
      throw new Error(`NDW4 auth failed: invalid ${NDW4_REPLY_HEADER} payload.`);
    }

    return parsed;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private throwOnReplyError(reply: Ndw4ServerReply, stage: string): void {
    const message = reply.error ?? reply.e;

    if (typeof message === 'string' && message) {
      throw new Ndw4RejectedError(`NDW4 auth failed at ${stage} step: ${message}`);
    }
  }

  private createNonce(): Uint8Array {
    const nonce = new Uint8Array(16);

    return globalThis.crypto.getRandomValues(nonce);
  }

  /** Reply fields are `unknown`, so a missing one must be reported, never coerced into a string. */
  private requireString(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value) {
      throw new Error(`NDW4 auth failed: reply is missing the "${name}" field.`);
    }

    return value;
  }

  /**
   * An Argon2 cost parameter, which the device sends either as a number or as a decimal string.
   * Both forms are returned: `value` is what Argon2id is given, `raw` is what the AuthMessage signs.
   */
  private toCostParameter(value: unknown, name: string, min: number, max: number): {raw: string; value: number} {
    const isDigitString = typeof value === 'string' && /^\d+$/.test(value);
    const parsed = typeof value === 'number' || isDigitString ? Number(value) : Number.NaN;

    if (!Number.isInteger(parsed)) {
      throw new Error(`NDW4 auth failed: invalid ${name} value.`);
    }

    if (parsed < min || parsed > max) {
      throw new Error(`NDW4 auth failed: ${name} value out of range.`);
    }

    // Narrowed to a number or a digit string by the check above, so this cannot mangle the input.
    return {raw: String(value), value: parsed};
  }

  private xorBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
    if (left.length !== right.length) {
      throw new Error('NDW4 auth failed: proof length mismatch.');
    }

    const result = new Uint8Array(left.length);

    for (let index = 0; index < left.length; index += 1) {
      result[index] = left[index]! ^ right[index]!;
    }

    return result;
  }
}
