import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {FetchTransport} from '../../src';

function makeResponse(status: number, body: string = '{}') {
  return new Response(body, {status});
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

  describe('auth error handling', () => {
    it('should emit authError$ exactly once for a 401 from sendQueryArray', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(401));

      await firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});

      expect(authErrorCount).toBe(1);
    });

    it('should not emit authError$ for a non-401 error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeResponse(500));

      await firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});

      expect(authErrorCount).toBe(0);
    });
  });
});
