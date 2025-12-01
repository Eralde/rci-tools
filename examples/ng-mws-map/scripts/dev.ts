#!/usr/bin/env node
import {spawn} from 'node:child_process';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {updateLocalProxyConfiguration} from './configure-proxy';
import {DEFAULT_ADDR} from './conf';

const argv = yargs(hideBin(process.argv))
  .option(
    'addr',
    {
      alias: 'a',
      type: 'string',
      description: 'Device IP address',
      default: DEFAULT_ADDR,
    },
  )
  .parseSync();

console.log(`[Dev]: Configuring proxy for "${argv.addr}"`);
updateLocalProxyConfiguration(argv.addr);

console.log('[Dev]: Starting Angular dev server...');
const ngServe = spawn(
  'ng',
  ['serve'],
  {
    stdio: 'inherit',
    shell: true,
  },
);

ngServe.on(
  'error',
  (error) => {
    console.error('[Dev]: Failed to start Angular dev server:', error);
    process.exit(1);
  },
);

ngServe.on(
  'exit',
  (code) => {
    process.exit(code ?? 0);
  },
);

process.on(
  'SIGINT',
  () => {
    ngServe.kill('SIGINT');
  },
);

process.on(
  'SIGTERM',
  () => {
    ngServe.kill('SIGTERM');
  },
);
