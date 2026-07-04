import {beforeAll, describe, expect, it} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {FetchTransport, RciResponseHelper} from '../../../src';

const IP_ADDRESS = process.env.RCI_DEVICE_IP;

if (!IP_ADDRESS) {
  throw new Error('Device IP address was not provided. Use --addr <device-ip>');
}

const host = String(IP_ADDRESS).startsWith('http://')
  ? String(IP_ADDRESS)
  : `http://${String(IP_ADDRESS)}`;

const rciPath = `${host}/rci/`;

const ERR_TESTS = {
  UNKNOWN_COMMAND: {
    payload: {inteface: {foo: {}}}, // typo: `inteface` -> `interface`
    errorCode: '1179781',
  },
  INVALID_INTERFACE_NAME_FORMAT: {
    payload: {interface: {foo: {}}},
    errorCode: '6553730',
  },
  UNSUPPORTED_INTERFACE_TYPE: {
    payload: {interface: {Foo0: {}}},
    errorCode: '6553602',
  },
};

describe('RciResponseHelper (integration)', () => {
  let transport: FetchTransport;

  beforeAll(() => {
    transport = new FetchTransport();
  });

  const testCases = (Object.keys(ERR_TESTS) as (keyof typeof ERR_TESTS)[])
    .map((key) => {
      return {
        key,
        ...ERR_TESTS[key],
      };
    });

  it.each(testCases)('should detect error for $key', async ({key, errorCode, payload}) => {
    const response = await firstValueFrom(transport.post(rciPath, payload));

    expect(RciResponseHelper.hasErrors(response.data), `[${key}] expected hasErrors to be true`).toBe(true);
    expect(RciResponseHelper.hasCode(errorCode, response.data), `[${key}] expected hasCode to find ${errorCode}`)
      .toBe(true);

    const errors = RciResponseHelper.getErrors(response.data);
    const errorEntry = Object.values(errors).find((e) => e.code === errorCode);

    expect(errorEntry, `[${key}] expected error with code ${errorCode} to be present`).toBeDefined();
    expect(errorEntry!.code, `[${key}] expected error code to match`).toBe(errorCode);
  });
});
