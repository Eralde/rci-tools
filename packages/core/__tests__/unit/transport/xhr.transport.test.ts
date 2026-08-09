import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {XHRTransport} from '../../../src';

class FakeXHR {
  public static DONE = 4;
  public readonly DONE = 4;
  public readyState = 0;
  public status = 0;
  public responseText = '';
  public withCredentials = false;
  public onreadystatechange: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public method = '';
  public url = '';
  public body: BodyInit | null = null;
  public readonly requestHeaders: Record<string, string> = {};
  private responseHeaders = '';

  public open(method: string, url: string): void {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }

  public setRequestHeader(name: string, value: string): void {
    this.requestHeaders[name] = value;
  }

  public send(body?: BodyInit | null): void {
    this.body = body ?? null;
    this.readyState = 2;
  }

  public respond(status: number, responseText: string, headers: string): void {
    this.status = status;
    this.responseText = responseText;
    this.responseHeaders = headers;
    this.readyState = FakeXHR.DONE;
    this.onreadystatechange?.();
  }

  public fail(): void {
    this.onerror?.();
  }

  public getAllResponseHeaders(): string {
    return this.responseHeaders;
  }
}

const createXHRMock = (): {new(): FakeXHR; DONE: number} => {
  const instances: FakeXHR[] = [];

  const factory = vi.fn((): FakeXHR => {
    const xhr = new FakeXHR();
    instances.push(xhr);

    return xhr;
  });

  const mock = factory as unknown as {new(): FakeXHR; DONE: number; instances: FakeXHR[]};
  mock.DONE = 4;
  mock.instances = instances;

  return mock;
};

const AUTH_CHALLENGE_HEADERS = [
  'WWW-Authenticate: x-ndw2-interactive realm="Keenetic Hopper 4G+" challenge="abc" session_id="s1" session_cookie="c1"',
  'WWW-Authenticate: x-ndw4-interactive endpoint="/auth" data="e30="',
  'X-NDM-Realm: Keenetic Hopper 4G+',
  'X-NDM-Challenge: abc',
  'X-NDM-Data: e30=',
].join('\r\n');

describe('XHRTransport', () => {
  let transport: XHRTransport;
  let authErrorCount: number;
  let xhrMock: {new(): FakeXHR; DONE: number; instances: FakeXHR[]};

  beforeEach(() => {
    xhrMock = createXHRMock();
    vi.stubGlobal('XMLHttpRequest', xhrMock);

    transport = new XHRTransport();
    authErrorCount = 0;
    transport.authError$.subscribe(() => authErrorCount++);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('auth error handling', () => {
    it('should emit authError$ exactly once for a 401 from sendQueryArray', async () => {
      const promise = firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});

      xhrMock.instances[0]!.respond(401, '', '');

      await promise;

      expect(authErrorCount).toBe(1);
    });

    it('should not emit authError$ for a non-401 error', async () => {
      const promise = firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});

      xhrMock.instances[0]!.respond(500, '', '');

      await promise;

      expect(authErrorCount).toBe(0);
    });

    it('suspends and resumes authError$ through authErrorSuspension', async () => {
      transport.authErrorSuspension.suspend();

      const suspended = firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});
      xhrMock.instances[0]!.respond(401, '', '');
      await suspended;
      expect(authErrorCount).toBe(0);

      transport.authErrorSuspension.resume();

      const resumed = firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});
      xhrMock.instances[1]!.respond(401, '', '');
      await resumed;
      expect(authErrorCount).toBe(1);
    });
  });

  describe('response handling', () => {
    it('enables credentials for browser-managed auth cookies', async () => {
      const promise = firstValueFrom(transport.get('http://example.com/auth'));

      expect(xhrMock.instances[0]!.withCredentials).toBe(true);

      xhrMock.instances[0]!.respond(200, '{}', '');
      await promise;
    });

    it('rejects network failures as errors rather than status-0 responses', async () => {
      const promise = firstValueFrom(transport.get('http://example.com/auth'));

      xhrMock.instances[0]!.fail();

      const error = await promise.catch((reason) => reason);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('XMLHttpRequest request failed');
    });

    it('resolves a 200 with parsed JSON data', async () => {
      const promise = firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}]));

      xhrMock.instances[0]!.respond(200, JSON.stringify([{ok: true}]), 'Content-Type: application/json');

      await expect(promise).resolves.toEqual([{ok: true}]);
    });

    it('issues a DELETE request', async () => {
      const promise = firstValueFrom(transport.delete('http://example.com/auth')).catch(() => {});

      xhrMock.instances[0]!.respond(200, '{}', '');
      await promise;

      expect(xhrMock.instances[0]!.method).toBe('DELETE');
    });

    it('sends JSON headers and body on POST', async () => {
      const promise = firstValueFrom(transport.post('http://example.com/rci/', {a: 1})).catch(() => {});

      xhrMock.instances[0]!.respond(200, '{}', '');
      await promise;

      expect(xhrMock.instances[0]!.requestHeaders['Content-Type']).toBe('application/json');
      expect(xhrMock.instances[0]!.requestHeaders['Accept']).toBe('application/json');
      expect(xhrMock.instances[0]!.body).toBe(JSON.stringify({a: 1}));
    });
  });

  describe('header access', () => {
    it('getHeader is case-insensitive and returns "" for missing', async () => {
      const promise = firstValueFrom(transport.get('http://example.com/auth')).catch((response) => response);

      xhrMock.instances[0]!.respond(401, '', 'X-NDM-Data: e30=');

      const response = await promise;

      expect(transport.getHeader(response, 'x-ndm-data')).toBe('e30=');
      expect(transport.getHeader(response, 'X-NDM-Data')).toBe('e30=');
      expect(transport.getHeader(response, 'Missing')).toBe('');
    });

    it('preserves multiple WWW-Authenticate headers (Firefox fetch bug workaround)', async () => {
      const promise = firstValueFrom(transport.get('http://example.com/auth')).catch((response) => response);

      xhrMock.instances[0]!.respond(401, '', AUTH_CHALLENGE_HEADERS);

      const response = await promise;
      const header = transport.getHeader(response, 'WWW-Authenticate');

      expect(header).toContain('x-ndw2-interactive');
      expect(header).toContain('x-ndw4-interactive');

      const endpoint = header.match(/endpoint="([^"]+)"/)?.[1];
      expect(endpoint).toBe('/auth');
    });
  });
});
