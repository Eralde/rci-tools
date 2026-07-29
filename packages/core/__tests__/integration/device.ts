import {describe} from 'vitest';

// Keep this test-only normalization aligned with Spec 5's createRciClient when that helper lands.
export const normalizeDeviceHost = (address: string | undefined = undefined): string => {
  if (!address) {
    return '';
  }

  return /^https?:\/\//.test(address) ? address : `http://${address}`;
};

export const getDeviceHost = (): string => normalizeDeviceHost(process.env.RCI_DEVICE_IP);

export const describeWithDevice = process.env.RCI_DEVICE_IP ? describe : describe.skip;
