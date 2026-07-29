import {afterEach, describe, expect, it, vi} from 'vitest';
import {getDeviceHost, normalizeDeviceHost} from '../integration/device';

describe('integration device helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an empty host when no address is configured', () => {
    expect(normalizeDeviceHost()).toBe('');
  });

  it('adds the HTTP scheme to a bare device address', () => {
    expect(normalizeDeviceHost('192.0.2.1')).toBe('http://192.0.2.1');
  });

  it('preserves an existing HTTP scheme', () => {
    expect(normalizeDeviceHost('http://192.0.2.1')).toBe('http://192.0.2.1');
  });

  it('preserves an existing HTTPS scheme', () => {
    expect(normalizeDeviceHost('https://192.0.2.1')).toBe('https://192.0.2.1');
  });

  it('reads the device address from the current environment', () => {
    vi.stubEnv('RCI_DEVICE_IP', '192.0.2.1');

    expect(getDeviceHost()).toBe('http://192.0.2.1');
  });
});
