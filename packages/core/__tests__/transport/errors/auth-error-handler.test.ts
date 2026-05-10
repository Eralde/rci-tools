import {describe, expect, it, vi} from 'vitest';
import {firstValueFrom, of, throwError} from 'rxjs';
import {catchError, toArray} from 'rxjs/operators';
import {AuthErrorHandler} from '../../../src/transport/errors/auth-error-handler';

describe('AuthErrorHandler', () => {
  describe('is401Error', () => {
    it('returns true for {status: 401}', () => {
      expect(AuthErrorHandler.is401Error({status: 401})).toBe(true);
    });

    it('returns false for non-401 status', () => {
      expect(AuthErrorHandler.is401Error({status: 500})).toBe(false);
      expect(AuthErrorHandler.is401Error({status: 200})).toBe(false);
    });

    it('returns false for non-object errors', () => {
      expect(AuthErrorHandler.is401Error(null)).toBe(false);
      expect(AuthErrorHandler.is401Error(undefined)).toBe(false);
      expect(AuthErrorHandler.is401Error('unauthorized')).toBe(false);
      expect(AuthErrorHandler.is401Error({})).toBe(false);
    });
  });

  describe('handleAuthError()', () => {
    it('emits to authError$ exactly once on 401 and rethrows', async () => {
      const handler = new AuthErrorHandler();
      const spy = vi.fn();
      handler.authError$.subscribe(spy);

      const err = {status: 401};
      const run = firstValueFrom(
        throwError(() => err)
          .pipe(handler.handleAuthError<unknown>(), catchError((e) => of(e))),
      );

      await expect(run).resolves.toBe(err);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not emit to authError$ on non-401 and rethrows', async () => {
      const handler = new AuthErrorHandler();
      const spy = vi.fn();
      handler.authError$.subscribe(spy);

      const err = {status: 500};
      const run = firstValueFrom(
        throwError(() => err)
          .pipe(handler.handleAuthError<unknown>(), catchError((e) => of(e))),
      );

      await expect(run).resolves.toBe(err);
      expect(spy).not.toHaveBeenCalled();
    });

    it('passes values through unchanged when no error', async () => {
      const handler = new AuthErrorHandler();
      const result = await firstValueFrom(
        of(1, 2, 3).pipe(handler.handleAuthError<number>(), toArray()),
      );
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('destroy()', () => {
    it('completes authError$', async () => {
      const handler = new AuthErrorHandler();
      const completed = vi.fn();
      handler.authError$.subscribe({complete: completed});

      handler.destroy();
      expect(completed).toHaveBeenCalledTimes(1);
    });
  });
});
