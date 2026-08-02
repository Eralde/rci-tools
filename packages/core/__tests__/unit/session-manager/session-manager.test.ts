import {describe, expect, it, vi} from 'vitest';
import {NEVER, Subject, catchError, firstValueFrom, of, throwError} from 'rxjs';
import {AuthErrorHandler, type BaseHttpResponse, type HttpTransport, SessionManager} from '../../../src';

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
