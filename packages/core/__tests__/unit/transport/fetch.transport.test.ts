import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {FetchTransport, RciHttpError, type FetchTransportResponse} from '../../../src';

function makeResponse(status: number, body: string = '{}', headers?: HeadersInit) {
  return new Response(status === 204 ? null : body, {status, headers});
}

describe('FetchTransport', () => {
  let transport: FetchTransport;
  let authErrorCount: number;

  beforeEach(() => {
    transport = new FetchTransport();
    authErrorCount = 0;
    transport.authError$.subscribe(() => authErrorCount++);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cancellation', () => {
    it('does not call fetch until subscribed', () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(200));

      transport.get('http://example.com/rci/');

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('aborts the request when unsubscribed before completion', () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockReturnValue(new Promise<Response>(() => {}));

      const subscription = transport.post('http://example.com/rci/', [{}]).subscribe();
      const signal = fetchSpy.mock.calls[0]![1]!.signal!;

      expect(signal.aborted).toBe(false);

      subscription.unsubscribe();

      expect(signal.aborted).toBe(true);
    });

    it('starts an independent request on each subscription', () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockReturnValue(new Promise<Response>(() => {}));
      const request$ = transport.post('http://example.com/rci/', [{}]);

      const first = request$.subscribe();
      const second = request$.subscribe();

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const firstSignal = fetchSpy.mock.calls[0]![1]!.signal!;
      const secondSignal = fetchSpy.mock.calls[1]![1]!.signal!;

      first.unsubscribe();

      expect(firstSignal.aborted).toBe(true);
      expect(secondSignal.aborted).toBe(false);

      second.unsubscribe();
    });
  });

  describe('request shape', () => {
    it('sends GET to the given URL without a body', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(200));

      await firstValueFrom(transport.get('http://example.com/auth'));

      const [url, init] = fetchSpy.mock.calls[0]!;

      expect(url).toBe('http://example.com/auth');
      expect(init!.method ?? 'GET').toBe('GET');
      expect(init!.body).toBeUndefined();
    });

    it('sends POST with a JSON body and JSON headers', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(200));

      await firstValueFrom(transport.post('http://example.com/rci/', [{show: {version: {}}}]));

      const [url, init] = fetchSpy.mock.calls[0]!;

      expect(url).toBe('http://example.com/rci/');
      expect(init!.method).toBe('POST');
      expect(init!.body).toBe(JSON.stringify([{show: {version: {}}}]));
      expect(new Headers(init!.headers).get('Content-Type')).toBe('application/json');
      expect(new Headers(init!.headers).get('Accept')).toBe('application/json');
    });

    it('sends DELETE to the given URL without a body', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(200));

      await firstValueFrom(transport.delete('http://example.com/auth'));

      const [url, init] = fetchSpy.mock.calls[0]!;

      expect(url).toBe('http://example.com/auth');
      expect(init!.method).toBe('DELETE');
      expect(init!.body).toBeUndefined();
    });
  });

  describe('auth error handling', () => {
    it('should emit authError$ exactly once for a 401 from post', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(401));

      await firstValueFrom(transport.post('http://example.com/rci/', [{}])).catch(() => {});

      expect(authErrorCount).toBe(1);
    });

    it('should not emit authError$ for a non-401 error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(500));

      await firstValueFrom(transport.post('http://example.com/rci/', [{}])).catch(() => {});

      expect(authErrorCount).toBe(0);
    });

    it('suspends and resumes authError$ through authErrorSuspension', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve(makeResponse(401)));

      transport.authErrorSuspension.suspend();
      await firstValueFrom(transport.post('http://example.com/rci/', [{}])).catch(() => {});
      expect(authErrorCount).toBe(0);

      transport.authErrorSuspension.resume();
      await firstValueFrom(transport.post('http://example.com/rci/', [{}])).catch(() => {});
      expect(authErrorCount).toBe(1);
    });
  });

  describe('response handling', () => {
    it('treats 204 with an empty body as success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(204, '', {'X-Reply': 'empty'}));

      const response = await firstValueFrom(transport.get('http://example.com/auth'));

      expect(response).toMatchObject({status: 204, data: {}});
      expect(transport.getHeader(response, 'X-Reply')).toBe('empty');
    });

    it('treats 201 as success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(201, '{"created":true}'));

      await expect(firstValueFrom(transport.post('http://example.com/rci/', {}))).resolves.toMatchObject({
        status: 201,
        data: {created: true},
      });
    });

    it('exposes the parsed body of a non-2xx reply', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        makeResponse(500, '{"error":"x"}', {'X-Error': 'server'}),
      );

      const error = await firstValueFrom(transport.get('http://example.com/auth')).catch((reason) => reason);

      expect(error).toBeInstanceOf(RciHttpError);
      expect(error.status).toBe(500);
      expect(error.response.data).toEqual({error: 'x'});
      expect(transport.getHeader(error.response as FetchTransportResponse, 'X-Error')).toBe('server');
    });

    it('reports a network failure as status null', async () => {
      const cause = new TypeError('fetch failed');
      vi.spyOn(global, 'fetch').mockRejectedValue(cause);

      const error = await firstValueFrom(transport.get('http://example.com/auth')).catch((reason) => reason);

      expect(error).toBeInstanceOf(RciHttpError);
      expect(error.status).toBeNull();
      expect(error.response).toBeNull();
      expect(error.cause).toBe(cause);
    });

    it('reports a failure to read the body as RciHttpError', async () => {
      const cause = new TypeError('body stream failed');
      const fetchResponse = makeResponse(200);
      vi.spyOn(fetchResponse, 'text').mockRejectedValue(cause);
      vi.spyOn(global, 'fetch').mockResolvedValue(fetchResponse);

      const error = await firstValueFrom(transport.get('http://example.com/auth')).catch((reason) => reason);

      expect(error).toBeInstanceOf(RciHttpError);
      expect(error.status).toBe(200);
      expect(error.response).toBeNull();
      expect(error.cause).toBe(cause);
    });

    it('keeps a 401 status and emits authError$ when reading the body fails', async () => {
      const cause = new TypeError('body stream failed');
      const fetchResponse = makeResponse(401);
      vi.spyOn(fetchResponse, 'text').mockRejectedValue(cause);
      vi.spyOn(global, 'fetch').mockResolvedValue(fetchResponse);

      const error = await firstValueFrom(transport.post('http://example.com/rci/', [{}])).catch((reason) => reason);

      expect(error).toBeInstanceOf(RciHttpError);
      expect(error.status).toBe(401);
      expect(error.cause).toBe(cause);
      expect(authErrorCount).toBe(1);
    });

    it('getHeader returns null for a missing header', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(200));

      const response = await firstValueFrom(transport.get('http://example.com/auth'));

      expect(transport.getHeader(response, 'Missing')).toBeNull();
    });
  });
});
