import {firstValueFrom} from 'rxjs';
import {describe, expect, it, vi} from 'vitest';
import {AxiosError, AxiosHeaders, type AxiosInstance, type AxiosResponse} from 'axios';
import {AxiosTransport} from './axios.transport';

const makeResponse = (data: unknown = {ok: true}): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
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

    expect(client.get).toHaveBeenCalledWith('http://device/auth', {withCredentials: true});
    expect(client.post).toHaveBeenCalledWith('http://device/rci/', [{}], {withCredentials: true});
    expect(client.delete).toHaveBeenCalledWith('http://device/auth', {withCredentials: true});
  });

  it('extracts response data in sendQueryArray()', async () => {
    const transport = new AxiosTransport(makeClient(makeResponse([{show: {version: '1'}}])));

    await expect(firstValueFrom(transport.sendQueryArray('http://device/rci/', [{}]))).resolves.toEqual([
      {show: {version: '1'}},
    ]);
  });

  it('reads headers case-insensitively', () => {
    const transport = new AxiosTransport(makeClient());

    expect(transport.getHeader(makeResponse(), 'x-test')).toBe('yes');
  });

  it('detects Axios network errors by error.code', () => {
    const transport = new AxiosTransport(makeClient());

    expect(transport.isNetworkError(new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED'))).toBe(true);
    expect(transport.isNetworkError(new AxiosError('timeout', 'ETIMEDOUT'))).toBe(true);
    expect(transport.isNetworkError(new AxiosError('bad response', 'ERR_BAD_RESPONSE'))).toBe(false);
    expect(transport.isNetworkError({code: 'ECONNREFUSED'})).toBe(false);
  });
});
