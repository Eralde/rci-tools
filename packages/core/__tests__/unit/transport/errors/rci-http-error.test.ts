import {describe, expect, it} from 'vitest';
import {RciHttpError, isRciHttpError} from '../../../../src';

describe('RciHttpError', () => {
  it('exposes status, response, cause, and Error identity', () => {
    const cause = new Error('underlying');
    const response = {status: 500, data: {e: 1}};
    const error = new RciHttpError('HTTP 500', {status: 500, response, cause});

    expect(error.status).toBe(500);
    expect(error.response).toBe(response);
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('RciHttpError');
    expect(error).toBeInstanceOf(Error);
  });

  it('defaults response to null', () => {
    expect(new RciHttpError('Network request failed', {status: null}).response).toBeNull();
  });

  it('recognizes an error from another package copy by brand', () => {
    const foreignError = new Error('HTTP 503');
    Object.defineProperty(foreignError, Symbol.for('@rci-tools/core/RciHttpError'), {value: true});
    Object.assign(foreignError, {status: 503});

    expect(isRciHttpError(foreignError)).toBe(true);
    expect(isRciHttpError({status: 500})).toBe(false);
    expect(isRciHttpError(new Error('x'))).toBe(false);
    expect(isRciHttpError(null)).toBe(false);
    expect(isRciHttpError('x')).toBe(false);
  });
});
