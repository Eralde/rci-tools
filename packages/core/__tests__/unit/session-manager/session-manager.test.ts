import {describe, expect, it, vi} from 'vitest';
import {firstValueFrom, of, throwError} from 'rxjs';
import {type BaseHttpResponse, type HttpTransport, SessionManager} from '../../../src';

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
