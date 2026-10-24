import {firstValueFrom} from 'rxjs';
import {describe, expect, it, vi} from 'vitest';
import {AxiosError, AxiosHeaders, type AxiosInstance, type AxiosResponse} from 'axios';
import {RciHttpError} from '@rci-tools/core';
import {AxiosTransport} from './axios.transport';

const makeResponse = (data: unknown = {ok: true}, status = 200): AxiosResponse => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : '',
  headers: new AxiosHeaders({'X-Test': 'yes'}),
  config: {headers: new AxiosHeaders()},
});

const makeClient = (response: AxiosResponse = makeResponse()): AxiosInstance =>
  ({
    get: vi.fn().mockResolvedValue(response),
    post: vi.fn().mockResolvedValue(response),
    delete: vi.fn().mockResolvedValue(response),
  }) as unknown as AxiosInstance;

describe('AxiosTransport', () => {
  it('uses injected Axios client for requests', async () => {
    const response = makeResponse({answer: 42});
    const client = makeClient(response);
    const transport = new AxiosTransport(client);

    await expect(firstValueFrom(transport.get('http://device/auth'))).resolves.toBe(response);
    await expect(firstValueFrom(transport.post('http://device/rci/', [{}]))).resolves.toBe(response);
    await expect(firstValueFrom(transport.delete('http://device/auth'))).resolves.toBe(response);

    const config = expect.objectContaining({withCredentials: true, signal: expect.any(AbortSignal)});

    expect(client.get).toHaveBeenCalledWith('http://device/auth', config);
    expect(client.post).toHaveBeenCalledWith('http://device/rci/', [{}], config);
    expect(client.delete).toHaveBeenCalledWith('http://device/auth', config);
  });

  it('does not send a request until subscribed', () => {
    const client = makeClient();
    const transport = new AxiosTransport(client);

    transport.get('http://device/auth');

    expect(client.get).not.toHaveBeenCalled();
  });

  it('aborts the request when unsubscribed before completion', () => {
    const client = makeClient();
    vi.mocked(client.post).mockReturnValue(new Promise(() => {}));
    const transport = new AxiosTransport(client);

    const subscription = transport.post('http://device/rci/', [{}]).subscribe();
    const signal = vi.mocked(client.post).mock.calls[0]![2]!.signal as AbortSignal;

    expect(signal.aborted).toBe(false);

    subscription.unsubscribe();

    expect(signal.aborted).toBe(true);
  });

  it('treats any 2xx as success even if the client default rejects it', async () => {
    const response = makeResponse({}, 204);
    const client = makeClient(response);
    vi.mocked(client.get).mockImplementation((_url, config) => {
      const validateStatus = config?.validateStatus ?? ((status) => status === 200);

      return validateStatus(response.status)
        ? Promise.resolve(response)
        : Promise.reject(new AxiosError('Request failed', 'ERR_BAD_REQUEST'));
    });
    const transport = new AxiosTransport(client);

    await expect(firstValueFrom(transport.get('http://device/auth'))).resolves.toBe(response);
    expect(client.get).toHaveBeenCalledWith(
      'http://device/auth',
      expect.objectContaining({
        validateStatus: expect.any(Function),
      }),
    );
  });

  it('wraps an HTTP error response', async () => {
    const response = makeResponse({error: 'server'}, 500);
    const cause = new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
    const client = makeClient();
    vi.mocked(client.get).mockRejectedValue(cause);
    const transport = new AxiosTransport(client);

    const error = await firstValueFrom(transport.get('http://device/auth')).catch((reason) => reason);

    expect(error).toBeInstanceOf(RciHttpError);
    expect(error.status).toBe(500);
    expect(error.response).toBe(response);
    expect(error.cause).toBe(cause);
  });

  it('wraps a network failure as status null', async () => {
    const cause = new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED');
    const client = makeClient();
    vi.mocked(client.get).mockRejectedValue(cause);
    const transport = new AxiosTransport(client);

    const error = await firstValueFrom(transport.get('http://device/auth')).catch((reason) => reason);

    expect(error).toBeInstanceOf(RciHttpError);
    expect(error.status).toBeNull();
    expect(error.response).toBeNull();
    expect(error.cause).toBe(cause);
  });

  it('emits authError$ for a 401 unless suspended', async () => {
    const response = makeResponse({error: 'unauthorized'}, 401);
    const cause = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, response);
    const client = makeClient();
    vi.mocked(client.get).mockRejectedValue(cause);
    const transport = new AxiosTransport(client);
    const emitted = vi.fn();
    transport.authError$.subscribe(emitted);

    await firstValueFrom(transport.get('http://device/auth')).catch(() => {});
    expect(emitted).toHaveBeenCalledTimes(1);

    transport.authErrorSuspension.suspend();
    await firstValueFrom(transport.get('http://device/auth')).catch(() => {});
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('reads headers case-insensitively and returns null for a missing header', () => {
    const transport = new AxiosTransport(makeClient());

    expect(transport.getHeader(makeResponse(), 'x-test')).toBe('yes');
    expect(transport.getHeader(makeResponse(), 'missing')).toBeNull();
  });
});
