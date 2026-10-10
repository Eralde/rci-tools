import {describe, expect, it, vi} from 'vitest';
import {NEVER, Subject, catchError, firstValueFrom, of, throwError} from 'rxjs';
import {
  AUTH_PROTOCOL,
  AuthErrorHandler,
  type AuthProtocolName,
  type BaseHttpResponse,
  type HttpTransport,
  LOGIN_FAILURE_REASON,
  SessionManager,
} from '../../../src';

const makeTransport = (overrides: Partial<HttpTransport<BaseHttpResponse>> = {}): HttpTransport<BaseHttpResponse> => ({
  get: vi.fn().mockReturnValue(of({status: 200, data: {}})),
  post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
  delete: vi.fn().mockReturnValue(of({status: 200, data: {}})),
  getHeader: vi.fn().mockReturnValue(''),
  onAuthRequest: vi.fn(),
  clearAuthData: vi.fn(),
  sendQueryArray: vi.fn(),
  ...overrides,
});

const makeSuspension = () => ({
  suspend: vi.fn(),
  resume: vi.fn(),
});

describe('SessionManager', () => {
  it('isAuthenticated() treats error.response as auth response', async () => {
    const response = {status: 401, data: {}};
    const transport = makeTransport({get: vi.fn().mockReturnValue(throwError(() => ({response})))});
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.isAuthenticated())).resolves.toBe(false);
    expect(transport.onAuthRequest).toHaveBeenCalledWith(response);
  });

  it('login() returns true when auth endpoint already returns 200', async () => {
    const response = {status: 200, data: {}};
    const transport = makeTransport({get: vi.fn().mockReturnValue(of(response))});
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(true);
    expect(transport.post).not.toHaveBeenCalled();
    expect(transport.onAuthRequest).toHaveBeenCalledWith(response);
  });

  it('suspends only on login subscription and resumes on completion', async () => {
    const authErrorSuspension = makeSuspension();
    const response = {status: 200, data: {}};
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(response)),
      authErrorSuspension,
    });
    const session = new SessionManager('http://device', transport);

    const login$ = session.login('admin', 'password');

    expect(authErrorSuspension.suspend).not.toHaveBeenCalled();
    await expect(firstValueFrom(login$)).resolves.toBe(true);
    expect(authErrorSuspension.suspend).toHaveBeenCalledTimes(1);
    expect(authErrorSuspension.resume).toHaveBeenCalledTimes(1);
  });

  it('resumes when login errors before protocol handling completes', async () => {
    const authErrorSuspension = makeSuspension();
    const failure = new Error('projection failure');
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of({status: 200, data: {}})),
      onAuthRequest: vi.fn(() => {
        throw failure;
      }),
      authErrorSuspension,
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.login('admin', 'password'))).rejects.toBe(failure);
    expect(authErrorSuspension.resume).toHaveBeenCalledTimes(1);
  });

  it('resumes when login is unsubscribed', () => {
    const authErrorSuspension = makeSuspension();
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(NEVER),
      authErrorSuspension,
    });
    const session = new SessionManager('http://device', transport);

    const subscription = session.login('admin', 'password').subscribe();
    expect(authErrorSuspension.suspend).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();

    expect(authErrorSuspension.resume).toHaveBeenCalledTimes(1);
  });

  it('shares one handshake across overlapping login subscriptions', () => {
    const response = {status: 200, data: {}};
    const pending = new Subject<BaseHttpResponse>();
    const get = vi.fn().mockReturnValue(pending);
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);
    const results: boolean[] = [];

    session.login('admin', 'password').subscribe((value) => results.push(value));
    session.login('admin', 'password').subscribe((value) => results.push(value));

    expect(get).toHaveBeenCalledTimes(1);

    pending.next(response);
    pending.complete();

    expect(results).toEqual([true, true]);
  });

  it('starts a fresh handshake after the previous flight settles', async () => {
    const response = {status: 200, data: {}};
    const get = vi.fn().mockReturnValue(of(response));
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(true);
    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(true);

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('shares a false result and resets for a later login', async () => {
    const pending = new Subject<BaseHttpResponse>();
    const get = vi.fn()
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(of({status: 200, data: {}}));
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);
    const results: boolean[] = [];

    session.login('admin', 'password').subscribe((value) => results.push(value));
    session.login('admin', 'password').subscribe((value) => results.push(value));

    expect(get).toHaveBeenCalledTimes(1);

    pending.next({status: 401, data: {}});
    pending.complete();

    expect(results).toEqual([false, false]);
    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('shares an escaping error and resets for a later login', async () => {
    const response = {status: 200, data: {}};
    const pending = new Subject<BaseHttpResponse>();
    const failure = new Error('projection failure');
    const get = vi.fn()
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(of(response));
    const onAuthRequest = vi.fn(() => {
      throw failure;
    });
    const transport = makeTransport({get, onAuthRequest});
    const session = new SessionManager('http://device', transport);
    const errors: unknown[] = [];

    session.login('admin', 'password').subscribe({error: (error) => errors.push(error)});
    session.login('admin', 'password').subscribe({error: (error) => errors.push(error)});

    expect(get).toHaveBeenCalledTimes(1);

    pending.next(response);
    pending.complete();

    expect(errors).toEqual([failure, failure]);

    onAuthRequest.mockImplementation(() => undefined);
    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('suspends and resumes exactly once for an overlapping flight', () => {
    const authErrorSuspension = makeSuspension();
    const pending = new Subject<BaseHttpResponse>();
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(pending),
      authErrorSuspension,
    });
    const session = new SessionManager('http://device', transport);

    session.login('admin', 'password').subscribe();
    session.login('admin', 'password').subscribe();

    expect(authErrorSuspension.suspend).toHaveBeenCalledTimes(1);

    pending.next({status: 200, data: {}});
    pending.complete();

    expect(authErrorSuspension.resume).toHaveBeenCalledTimes(1);
  });

  it('cancels a shared flight after all subscribers unsubscribe', async () => {
    const authErrorSuspension = makeSuspension();
    const pending = new Subject<BaseHttpResponse>();
    const get = vi.fn()
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(of({status: 200, data: {}}));
    const transport = makeTransport({get, authErrorSuspension});
    const session = new SessionManager('http://device', transport);

    const first = session.login('admin', 'password').subscribe();
    const second = session.login('admin', 'password').subscribe();

    expect(get).toHaveBeenCalledTimes(1);

    first.unsubscribe();
    expect(authErrorSuspension.resume).not.toHaveBeenCalled();

    second.unsubscribe();
    expect(authErrorSuspension.resume).toHaveBeenCalledTimes(1);

    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('re-subscribes a stale outer observable to the current flight', () => {
    const current = new Subject<BaseHttpResponse>();
    const get = vi.fn()
      .mockReturnValueOnce(NEVER)
      .mockReturnValue(current);
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);
    const stale$ = session.login('first', 'password');
    const staleInitialSubscription = stale$.subscribe();

    expect(get).toHaveBeenCalledTimes(1);
    staleInitialSubscription.unsubscribe();

    const currentResults: boolean[] = [];
    session.login('second', 'password').subscribe((value) => currentResults.push(value));
    expect(get).toHaveBeenCalledTimes(2);

    const staleResults: boolean[] = [];
    stale$.subscribe((value) => staleResults.push(value));
    expect(get).toHaveBeenCalledTimes(2);

    current.next({status: 200, data: {}});
    current.complete();

    expect(currentResults).toEqual([true]);
    expect(staleResults).toEqual([true]);
  });

  it('uses first-subscribed login credentials structurally', () => {
    const pending = new Subject<BaseHttpResponse>();
    const get = vi.fn().mockReturnValue(pending);
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);
    const loginA = session.login('a', 'pa');
    const loginB = session.login('b', 'pb');
    const results: boolean[] = [];

    loginB.subscribe((value) => results.push(value));
    loginA.subscribe((value) => results.push(value));

    expect(get).toHaveBeenCalledTimes(1);

    pending.next({status: 200, data: {}});
    pending.complete();

    expect(results).toEqual([true, true]);
  });

  it('starts a fresh flight for synchronous false retry', () => {
    const get = vi.fn()
      .mockReturnValueOnce(of({status: 401, data: {}}))
      .mockReturnValueOnce(of({status: 200, data: {}}));
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);
    const results: boolean[] = [];

    session.login('admin', 'password').subscribe((value) => {
      results.push(value);

      if (!value) {
        session.login('admin', 'password').subscribe((retry) => results.push(retry));
      }
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(results).toEqual([false, true]);
  });

  it('starts a fresh flight for synchronous complete retry', () => {
    const response = {status: 200, data: {}};
    const get = vi.fn().mockReturnValue(of(response));
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);

    session.login('admin', 'password').subscribe({
      complete: () => {
        session.login('admin', 'password').subscribe();
      },
    });

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh flight for synchronous error retry', () => {
    const response = {status: 200, data: {}};
    const failure = new Error('projection failure');
    const get = vi.fn().mockReturnValue(of(response));
    const onAuthRequest = vi.fn(() => {
      throw failure;
    });
    const transport = makeTransport({get, onAuthRequest});
    const session = new SessionManager('http://device', transport);

    session.login('admin', 'password').subscribe({
      error: () => {
        onAuthRequest.mockImplementation(() => undefined);
        session.login('admin', 'password').subscribe();
      },
    });

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('keeps auth errors muted until the last overlapping login settles', async () => {
    const handler = new AuthErrorHandler();
    const emitted = vi.fn();
    handler.authError$.subscribe(emitted);
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(NEVER),
      authErrorSuspension: handler,
    });
    const session = new SessionManager('http://device', transport);
    const emit401 = async () => {
      await firstValueFrom(
        throwError(() => ({status: 401}))
          .pipe(handler.handleAuthError<unknown>(), catchError((error) => of(error))),
      );
    };

    const first = session.login('admin', 'password').subscribe();
    const second = session.login('admin', 'password').subscribe();

    await emit401();
    expect(emitted).not.toHaveBeenCalled();

    first.unsubscribe();
    await emit401();
    expect(emitted).not.toHaveBeenCalled();

    second.unsubscribe();
    await emit401();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('suppresses nested final validation but emits for standalone isAuthenticated', async () => {
    const handler = new AuthErrorHandler();
    const emitted = vi.fn();
    handler.authError$.subscribe(emitted);
    const initialResponse = {
      status: 401,
      data: {},
      headers: {
        'WWW-Authenticate': 'x-ndw2-interactive',
        'X-NDM-Challenge': 'challenge-token',
        'X-NDM-Realm': 'Keenetic',
      },
    };
    const unauthorizedResponse = {status: 401, data: {}, headers: {}};
    const get = vi.fn()
      .mockReturnValueOnce(
        throwError(() => initialResponse).pipe(handler.handleAuthError<BaseHttpResponse>()),
      )
      .mockReturnValueOnce(
        throwError(() => unauthorizedResponse).pipe(handler.handleAuthError<BaseHttpResponse>()),
      )
      .mockReturnValueOnce(
        throwError(() => unauthorizedResponse).pipe(handler.handleAuthError<BaseHttpResponse>()),
      );
    const transport = makeTransport({
      get,
      post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
      getHeader: vi.fn((response: BaseHttpResponse, name: string) => {
        return (response as BaseHttpResponse & {headers: Record<string, string>}).headers[name] ?? '';
      }),
      authErrorSuspension: handler,
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(false);
    expect(emitted).not.toHaveBeenCalled();

    await expect(firstValueFrom(session.isAuthenticated())).resolves.toBe(false);
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('logout() clears auth data even when DELETE fails', async () => {
    const transport = makeTransport({
      delete: vi.fn().mockReturnValue(throwError(() => ({
        status: 500,
        data: {},
      }))),
    });
    const session = new SessionManager('http://device', transport);

    await firstValueFrom(session.logout());
    expect(transport.clearAuthData).toHaveBeenCalledTimes(1);
  });

  it('getRealmHeader() returns X-NDM-Realm header', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of({status: 401, data: {}})),
      getHeader: vi.fn().mockReturnValue('Keenetic'),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.getRealmHeader())).resolves.toBe('Keenetic');
    expect(transport.getHeader).toHaveBeenCalledWith(expect.anything(), 'X-NDM-Realm');
  });

  it('login() completes when post errors and session is not authenticated', async () => {
    const transport = makeTransport({
      post: vi.fn().mockReturnValue(throwError(() => new Error('network'))),
      get: vi.fn().mockReturnValue(of({status: 401, data: {}})),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(false);
  });
});

const readHeader = (response: BaseHttpResponse, name: string): string => {
  const headers = (response as {headers?: Record<string, string>} | undefined)?.headers;

  return headers?.[name] ?? '';
};

const ndw2Challenge = {
  status: 401,
  data: {},
  headers: {
    'WWW-Authenticate': 'x-ndw2-interactive',
    'X-NDM-Challenge': 'challenge-token',
    'X-NDM-Realm': 'Keenetic',
  },
};

const ndw4Challenge = {
  status: 401,
  data: {},
  headers: {
    'WWW-Authenticate': 'x-ndw4-interactive realm="Keenetic" endpoint="/auth"',
  },
};

// NDW4 replies come as non-200 responses with a base64-encoded JSON in `X-NDM-Data`
const ndw4Reply = (reply: object) => {
  return throwError(() => ({
    response: {
      status: 401,
      data: {},
      headers: {'X-NDM-Data': Buffer.from(JSON.stringify(reply)).toString('base64')},
    },
  }));
};

// A valid phase 1 reply with the cheapest Argon2id parameters the protocol accepts
const ndw4FirstReply = (clientNonce: string) => {
  return ndw4Reply({
    salt: Buffer.alloc(16).toString('base64'),
    nonce: `${clientNonce}server`,
    iter: 1,
    memcost: 8,
  });
};

// Phase 1 sends `{login, nonce}`, phase 2 adds `proof`, phase 3 sends `signature-proof` instead
type Ndw4RequestData = {nonce: string; proof?: string; 'signature-proof'?: string};

const NDW2 = AUTH_PROTOCOL.NDW2;
const NDW4 = AUTH_PROTOCOL.NDW4;

const succeeded = (protocol: AuthProtocolName | null) => ({success: true, protocol});
const rejected = (protocol: AuthProtocolName | null) => ({success: false, reason: LOGIN_FAILURE_REASON.REJECTED,
  protocol});
const unavailable = (protocol: AuthProtocolName | null) => {
  return {success: false, reason: LOGIN_FAILURE_REASON.UNAVAILABLE, protocol};
};

describe('SessionManager.loginDetailed()', () => {
  it('reports success when the auth endpoint already returns 200', async () => {
    const transport = makeTransport({get: vi.fn().mockReturnValue(of({status: 200, data: {}}))});
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(succeeded(null));
  });

  it('reports an unavailable device when no auth protocol matches the response', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of({status: 403, data: {}, headers: {}})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(null));
  });

  it('reports an unavailable device when NDW2 challenge headers are missing', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of({status: 401, data: {}, headers: {'WWW-Authenticate': 'x-ndw2-interactive'}})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW2));
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('reports a rejected NDW2 login on 401 from POST /auth without re-checking the session', async () => {
    const get = vi.fn().mockReturnValue(of(ndw2Challenge));
    const transport = makeTransport({
      get,
      post: vi.fn().mockReturnValue(throwError(() => ({response: {status: 401, data: {}, headers: {}}}))),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW2));
    expect(get).toHaveBeenCalledTimes(1);
  });

  // FetchTransport and XHRTransport throw the response object itself, not `{response}`
  it('reports a rejected NDW2 login when the transport throws the 401 response itself', async () => {
    const get = vi.fn().mockReturnValue(of(ndw2Challenge));
    const transport = makeTransport({
      get,
      post: vi.fn().mockReturnValue(throwError(() => ({status: 401, data: {}, headers: {}}))),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW2));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reports an unavailable device when NDW2 POST /auth fails without a response', async () => {
    const transport = makeTransport({
      get: vi.fn()
        .mockReturnValueOnce(of(ndw2Challenge))
        .mockReturnValueOnce(throwError(() => ({response: {status: 401, data: {}, headers: {}}}))),
      post: vi.fn().mockReturnValue(throwError(() => new Error('network error'))),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW2));
  });

  it('reports an unavailable device when NDW2 POST is accepted but the final check finds no session', async () => {
    const get = vi.fn()
      .mockReturnValueOnce(of(ndw2Challenge))
      .mockReturnValueOnce(of({status: 401, data: {}, headers: {}}));
    const transport = makeTransport({
      get,
      post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW2));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('reports success when NDW2 POST /auth is accepted and the session is there', async () => {
    const transport = makeTransport({
      get: vi.fn()
        .mockReturnValueOnce(of(ndw2Challenge))
        .mockReturnValueOnce(of({status: 200, data: {}})),
      post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(succeeded(NDW2));
  });

  // Devices refuse a wrong NDW4 password this way: phase 2 answers as usual, but the signature
  // is computed from a key that does not match the password the client used
  it('reports a rejected NDW4 login on a server signature mismatch and sends no phase 3', async () => {
    const post = vi.fn((_url: string, data: Ndw4RequestData) => {
      return data.proof === undefined
        ? ndw4FirstReply(data.nonce)
        : ndw4Reply({signature: Buffer.alloc(64).toString('base64')});
    });
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW4));
    expect(post).toHaveBeenCalledTimes(2);
  });

  // e.g. an expired handshake state: the device answers phase 2 without the expected fields
  it('reports an unavailable device when the NDW4 phase 2 reply has no signature', async () => {
    const post = vi.fn((_url: string, data: Ndw4RequestData) => {
      return data.proof === undefined ? ndw4FirstReply(data.nonce) : ndw4Reply({});
    });
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW4));
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('reports a rejected NDW4 login on an error in a reply', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post: vi.fn().mockReturnValue(ndw4Reply({error: 'unknown login'})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW4));
  });

  it('reports a rejected NDW4 login on an error in the short `e` field', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post: vi.fn().mockReturnValue(ndw4Reply({e: 'unknown login'})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW4));
  });

  it('reports an unavailable device when an NDW4 reply has no X-NDM-Data', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post: vi.fn().mockReturnValue(throwError(() => ({response: {status: 502, data: {}, headers: {}}}))),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW4));
  });

  it('reports an unavailable device when an NDW4 request fails without a response', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post: vi.fn().mockReturnValue(throwError(() => new Error('network error'))),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW4));
  });

  // a caller that bounds the attempt with its own timeout
  it('sends no NDW4 phase 3 and releases the flight when unsubscribed during phase 2', async () => {
    const phase2 = new Subject<BaseHttpResponse>();
    const get = vi.fn().mockReturnValue(of(ndw4Challenge));
    const post = vi.fn((_url: string, data: Ndw4RequestData) => {
      return data.proof === undefined ? ndw4FirstReply(data.nonce) : phase2;
    });
    const transport = makeTransport({get, post, getHeader: vi.fn(readHeader)});
    const session = new SessionManager('http://device', transport);

    const subscription = session.loginDetailed('admin', 'password').subscribe();

    // Argon2id runs between phase 1 and phase 2, so phase 2 starts asynchronously
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    subscription.unsubscribe();

    phase2.complete();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(post).toHaveBeenCalledTimes(2);

    get.mockReturnValue(of({status: 200, data: {}}));

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(succeeded(null));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('propagates an escaping error instead of reporting a result', async () => {
    const failure = new Error('projection failure');
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of({status: 200, data: {}})),
      onAuthRequest: vi.fn(() => {
        throw failure;
      }),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).rejects.toBe(failure);
  });

  it('shares one flight between login() and loginDetailed()', () => {
    const pending = new Subject<BaseHttpResponse>();
    const get = vi.fn().mockReturnValue(pending);
    const transport = makeTransport({get});
    const session = new SessionManager('http://device', transport);
    const results: unknown[] = [];

    session.loginDetailed('admin', 'password').subscribe((value) => results.push(value));
    session.login('admin', 'password').subscribe((value) => results.push(value));

    expect(get).toHaveBeenCalledTimes(1);

    pending.next({status: 200, data: {}});
    pending.complete();

    expect(results).toEqual([succeeded(null), true]);
  });

  it('login() maps a rejected login to false', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw4Challenge)),
      post: vi.fn().mockReturnValue(ndw4Reply({error: 'unknown login'})),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.login('admin', 'password'))).resolves.toBe(false);
  });
});

// a device that offers both protocols
const dualChallenge = {
  status: 401,
  data: {},
  headers: {
    'WWW-Authenticate': 'x-ndw4-interactive realm="Keenetic" endpoint="/auth", x-ndw2-interactive',
    'X-NDM-Challenge': 'challenge-token',
    'X-NDM-Realm': 'Keenetic',
  },
};

// NDW2 sends `{login, password}`, NDW4 starts with `{login, nonce}`
const ndw2Request = expect.objectContaining({password: expect.any(String)});
const ndw4Request = expect.objectContaining({nonce: expect.any(String)});

describe('SessionManager auth protocols', () => {
  it('prefers NDW4 when the device offers both protocols', async () => {
    const post = vi.fn().mockReturnValue(ndw4Reply({error: 'unknown login'}));
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(dualChallenge)),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW4));
    expect(post).toHaveBeenCalledWith(expect.any(String), ndw4Request);
  });

  it('uses only the allowed protocols', async () => {
    const post = vi.fn().mockReturnValue(of({status: 200, data: {}}));
    const transport = makeTransport({
      get: vi.fn()
        .mockReturnValueOnce(of(dualChallenge))
        .mockReturnValueOnce(of({status: 200, data: {}})),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport, {protocols: [NDW2]});

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(succeeded(NDW2));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(expect.any(String), ndw2Request);
  });

  it('follows the order of the allowed protocols', async () => {
    const post = vi.fn().mockReturnValue(throwError(() => ({response: {status: 401, data: {}, headers: {}}})));
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(dualChallenge)),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport, {protocols: [NDW2, NDW4]});

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW2));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(expect.any(String), ndw2Request);
  });

  it('does not fall back to another protocol after a failure', async () => {
    const post = vi.fn().mockReturnValue(ndw4Reply({error: 'unknown login'}));
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(dualChallenge)),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(rejected(NDW4));
    expect(post).not.toHaveBeenCalledWith(expect.any(String), ndw2Request);
  });

  it('does not fall back to another protocol after an unavailable result', async () => {
    const post = vi.fn().mockReturnValue(throwError(() => ({response: {status: 502, data: {}, headers: {}}})));
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(dualChallenge)),
      post,
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(NDW4));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalledWith(expect.any(String), ndw2Request);
  });

  it('reports no protocol when the initial GET /auth fails without a response', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(throwError(() => new Error('network error'))),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport);

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(null));
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('reports an unavailable device without a handshake when it offers no allowed protocol', async () => {
    const transport = makeTransport({
      get: vi.fn().mockReturnValue(of(ndw2Challenge)),
      getHeader: vi.fn(readHeader),
    });
    const session = new SessionManager('http://device', transport, {protocols: [NDW4]});

    await expect(firstValueFrom(session.loginDetailed('admin', 'password'))).resolves.toEqual(unavailable(null));
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('requires at least one protocol', () => {
    expect(() => new SessionManager('http://device', makeTransport(), {protocols: []}))
      .toThrow('at least one auth protocol is required');
  });

  it('rejects an unknown protocol', () => {
    const protocols = ['x-unknown-interactive' as AuthProtocolName];

    expect(() => new SessionManager('http://device', makeTransport(), {protocols}))
      .toThrow('unknown auth protocol "x-unknown-interactive"');
  });
});
