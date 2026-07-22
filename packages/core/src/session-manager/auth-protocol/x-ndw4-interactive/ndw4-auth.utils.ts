import {createHMAC, createSHA3} from 'hash-wasm';

export const sha3_512 = async (data: Uint8Array | string): Promise<Uint8Array> => {
  const hasher = await createSHA3(512);

  return hasher.init().update(data).digest('binary');
};

export const hmacSha3_512 = async (key: Uint8Array, data: Uint8Array | string): Promise<Uint8Array> => {
  const hasher = await createHMAC(createSHA3(512), key);

  return hasher.init().update(data).digest('binary');
};

export const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index]! ^ right[index]!;
  }

  return diff === 0;
};

export const encodeBase64 = (data: Uint8Array): string => {
  const binary = Array.from(data, (byte) => String.fromCharCode(byte)).join('');

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64');
  }

  throw new Error('No base64 encoder available.');
};

export const decodeBase64 = (value: string): Uint8Array => {
  if (typeof globalThis.atob === 'function') {
    return Uint8Array.from(globalThis.atob(value), (char) => char.charCodeAt(0));
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  throw new Error('No base64 decoder available.');
};
