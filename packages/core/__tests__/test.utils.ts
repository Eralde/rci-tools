import {expect, vi} from 'vitest';
import {of} from 'rxjs';
import type {BaseHttpResponse, HttpTransport} from '../src';

export const expectObjectContainingPath = (path: string): any => {
  const keys = path.split('.').filter(Boolean);

  // Remove empty strings
  if (keys.length === 0) {
    return expect.anything();
  }

  // Build from the innermost level outward
  let result = expect.anything();

  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i];

    result = expect.objectContaining({
      [key]: result
    });
  }

  return result;
};

export const expectArrayContainingPath = (paths: string[]): any => {
  const matchers = paths.map(path => expectObjectContainingPath(path));

  return expect.arrayContaining(matchers);
};

export function makeTransport(): HttpTransport<BaseHttpResponse> {
  return {
    get: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    post: vi.fn().mockReturnValue(of({status: 200, data: {}})),
    delete: vi.fn(),
    getHeader: vi.fn(),
    onAuthRequest: vi.fn(),
    clearAuthData: vi.fn(),
    sendQueryArray: vi.fn().mockImplementation((_, queryArray) => of(queryArray.map(() => ({})))),
  };
}
