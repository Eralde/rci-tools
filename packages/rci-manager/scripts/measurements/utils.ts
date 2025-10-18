import {Observable, Subject} from 'rxjs';
import process from 'node:process';

export const normalizeAddress = (addr) => {
  return addr.startsWith('http://')
    ? addr
    : `http://${addr}`;
};

export const isPlainDict = (a) => {
  return typeof a === 'object'
    && a !== null
    && Object.keys(a).every((key) => typeof a[key] === 'string');
};

export const queryToUrl = (rciBasePath, query) => {
  const paramsStr = isPlainDict(query.data)
    ? new URLSearchParams(query.data).toString()
    : '';

  const resource = query.path.replace(/\./g, '/');
  const suffix = paramsStr ? `?${paramsStr}` : '';

  return `${rciBasePath}${resource}${suffix}`;
}

export const measureObsDuration = (obs$) => {
  const sub$ = new Subject();
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

export const calculateStats = (durations) => {
  if (durations.length === 0) {
    return {average: 0, stdDev: 0};
  }

  const sum = durations.reduce((acc, val) => acc + val, 0);
  const average = sum / durations.length;

  const sumOfSquaredDifferences = durations.reduce((acc, val) => acc + Math.pow(val - average, 2), 0);
  const stdDev = Math.sqrt(sumOfSquaredDifferences / durations.length);

  return {average, stdDev};
};

export const getRandomSubset = (arr, size) => {
  const subsetSize = Math.max(0, Math.min(arr.length - 1, size));
  const shuffled = [...arr].sort(() => 0.5 - Math.random());

  return shuffled.slice(0, subsetSize);
};
