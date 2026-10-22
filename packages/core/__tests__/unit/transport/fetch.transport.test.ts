import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {FetchTransport} from '../../../src';

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

    it('suspends and resumes authError$ through authErrorSuspension', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve(makeResponse(401)));

      transport.authErrorSuspension.suspend();
      await firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});
      expect(authErrorCount).toBe(0);

      transport.authErrorSuspension.resume();
      await firstValueFrom(transport.sendQueryArray('http://example.com/rci/', [{}])).catch(() => {});
      expect(authErrorCount).toBe(1);
    });
  });
});
