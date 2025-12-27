import {Observable, Subject} from 'rxjs';
import process from 'node:process';
import {GenericObject, RciQuery} from '../../src';

export const normalizeAddress = (addr: string): string => {
  return addr.startsWith('http://')
    ? addr
    : `http://${addr}`;
};

export const isPlainDict = (a: any): a is GenericObject => {
  return typeof a === 'object'
    && a !== null
    && Object.keys(a).every((key) => typeof a[key] === 'string');
};

export const queryToUrl = (rciBasePath: string, query: RciQuery): string => {
  const paramsStr = isPlainDict(query.data)
    ? new URLSearchParams(query.data).toString()
    : '';

  const resource = query.path.replace(/\./g, '/');
  const suffix = paramsStr ? `?${paramsStr}` : '';

  return `${rciBasePath}${resource}${suffix}`;
};

export const measureObsDuration = (obs$: Observable<unknown>): Observable<number> => {
  const sub$ = new Subject<number>();
  const t0 = process.hrtime.bigint();

  obs$
    .subscribe({
      complete: () => {
        const t1 = process.hrtime.bigint();
        const durationMs = Number(t1 - t0) / 1_000_000;

        sub$.next(durationMs);
        sub$.complete();
      },
      error: (err) => {
        sub$.error(err);
      },
    });

  return sub$.asObservable();
};

export const calculateStats = (durations: number[]) => {
  if (durations.length === 0) {
    return {average: 0, stdDev: 0};
  }

  const sum = durations.reduce((acc, val) => acc + val, 0);
  const average = sum / durations.length;

  const sumOfSquaredDifferences = durations.reduce((acc, val) => acc + Math.pow(val - average, 2), 0);
  const stdDev = Math.sqrt(sumOfSquaredDifferences / durations.length);

  return {average, stdDev};
};

export const getRandomSubset = <T>(arr: T[], size: number): T[] => {
  const subsetSize = Math.max(0, Math.min(arr.length - 1, size));
  const shuffled = [...arr].sort(() => 0.5 - Math.random());

  return shuffled.slice(0, subsetSize);
};
