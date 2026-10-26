import {AUTH_PROTOCOL} from '@rci-tools/core';
import {runProtocolCheck} from './common';

const main = async (): Promise<void> => {
  await runProtocolCheck(AUTH_PROTOCOL.NDW4, [200, 301]);
};

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);

    process.exitCode = 1;
  });
