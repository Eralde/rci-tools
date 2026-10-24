import {describe, expect, it, vi} from 'vitest';
import {firstValueFrom, of, throwError} from 'rxjs';
import {RciHttpError} from '../../../src/transport/errors/rci-http-error';
import {sendQueryArray} from '../../../src/transport/send-query-array';
import {makeTransport} from '../test.utils';

describe('sendQueryArray', () => {
  it('posts the queries and returns the reply data', async () => {
    const transport = makeTransport();
    const queries = [{show: {version: {}}}];
    vi.mocked(transport.post).mockReturnValue(of({status: 200, data: [{a: 1}]}));

    await expect(firstValueFrom(sendQueryArray(transport, 'http://device/rci/', queries))).resolves.toEqual([{a: 1}]);
    expect(transport.post).toHaveBeenCalledWith('http://device/rci/', queries);
  });

  it('rejects a non-array batch reply', async () => {
    const transport = makeTransport();
    vi.mocked(transport.post).mockReturnValue(of({status: 200, data: {}}));

    const error = await firstValueFrom(sendQueryArray(transport, 'http://device/rci/', [{}])).catch(value => value);

    expect(error).toBeInstanceOf(RciHttpError);
    expect(error.status).toBe(200);
    expect(error.message).toBe('Malformed RCI response: expected an array');
    expect(error.response.data).toEqual({});
  });

  it('passes transport errors through', async () => {
    const transport = makeTransport();
    const error = new RciHttpError('HTTP 500', {status: 500});
    vi.mocked(transport.post).mockReturnValue(throwError(() => error));

    await expect(firstValueFrom(sendQueryArray(transport, 'http://device/rci/', [{}]))).rejects.toBe(error);
  });
});
