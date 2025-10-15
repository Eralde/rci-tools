import {beforeEach, afterEach, it, expect, describe, vi} from 'vitest';
import {forkJoin, firstValueFrom} from 'rxjs';
import * as _ from 'lodash';
import {FetchTransport, RciManager, RciQuery} from '../src';
import {expectArrayContainingPath} from './utils';

const IP_ADDRESS = process.env.RCI_DEVICE_IP;

if (!IP_ADDRESS) {
  throw new Error('Device IP address was not provided.');
}

const SHOW_VERSION = 'show.version';
const SHOW_IDENTIFICATION = 'show.identification';

const host = String(IP_ADDRESS).startsWith('http://')
  ? String(IP_ADDRESS)
  : `http://${String(IP_ADDRESS)}`;

const originalFetch = global.fetch;

let lastResponseBody: string;
let fetchSpy: any;

describe('RciManager.execute', () => {
  let rciManager: RciManager;
  let fetchTransport: FetchTransport;

  beforeEach(() => {
    fetchTransport = new FetchTransport();
    rciManager = new RciManager(host, fetchTransport);

    // Spy on global fetch using the original fetch to avoid recursion
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (...args: unknown[]) => {
      // @ts-ignore
      const response = await originalFetch(...args);
      const clone = response.clone();

      lastResponseBody = await clone.text();

      return response;
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should send only one HTTP request for multiple execute calls that fall into one batch', async () => {
    const query1: RciQuery = {path: SHOW_VERSION};
    const query2: RciQuery = {path: SHOW_IDENTIFICATION};

    const queries = [query1, query2];
    const execute$ = queries.map((query) => rciManager.execute(query));

    const result = await firstValueFrom(forkJoin(execute$));

    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only one HTTP request should be sent

    const body = fetchSpy.mock.calls[0][1]?.body;

    expect(body).toBeDefined();

    const sentQueries = JSON.parse(body);

    // The request body should be an array,
    expect(Array.isArray(result)).toBeTruthy();
    // ...containing the same number of elements as in `queries` (if there are no duplicates)
    expect(result.length).toBe(queries.length);

    const lastResponse = JSON.parse(lastResponseBody);
    const paths = queries.map((query) => query.path);

    expect(lastResponse).toEqual(
      expectArrayContainingPath(paths),
    );
  });

  it('should send only unique queries in HTTP request, but return results for all input queries', async () => {
    const queries: RciQuery[] = [
      {path: SHOW_VERSION},
      {path: SHOW_IDENTIFICATION},
      {path: SHOW_VERSION}, // duplicate
      {path: SHOW_VERSION}, // duplicate
      {path: SHOW_VERSION}, // duplicate
    ];

    const result = await firstValueFrom(rciManager.execute(queries));

    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only one HTTP request should be sent

    const body = fetchSpy.mock.calls[0][1]?.body;

    expect(body).toBeDefined();

    // The request body should be an array,
    expect(Array.isArray(result)).toBeTruthy();

    const lastResponse = JSON.parse(lastResponseBody);

    // ...containing fewer elements than in `queries` (duplicates should be removed)
    expect(lastResponse.length).toBeLessThan(queries.length);

    // The `result` however, should be an array with the same length as the `queries` array
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(queries.length);
  });
});
