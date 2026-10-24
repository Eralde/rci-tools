import {identity} from 'rxjs';
import type {MonoTypeOperatorFunction} from 'rxjs';
import {timeout} from 'rxjs/operators';

// the largest delay `setTimeout` accepts; a larger one overflows and fires almost at once
export const MAX_DURATION_MS = 2_147_483_647;

export function resolveDuration(
  name: string,
  value: number | undefined,
  options: {fallback: number; positive?: boolean},
): number {
  if (value === undefined) {
    return options.fallback;
  }

  const minimum = options.positive ? '> 0' : '>= 0';

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || (options.positive ? value <= 0 : value < 0)
    || value > MAX_DURATION_MS
  ) {
    throw new RangeError(`${name} must be a finite number ${minimum} and <= ${MAX_DURATION_MS}, got ${String(value)}`);
  }

  return value;
}

export function withRequestTimeout<T>(ms: number): MonoTypeOperatorFunction<T> {
  return ms === 0 ? identity : timeout(ms);
}
