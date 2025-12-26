#!/usr/bin/env node

import {spawn} from 'child_process';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import process from 'node:process';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --addr <device IP address>')
  .option(
    'addr',
    {
      alias: 'a',
      describe: 'Device IP address',
      type: 'string',
      demandOption: true,
    },
  )
  .help()
  .parseSync();

if (!argv.addr) {
  console.error('Error: You must provide the device IP as the first argument.');
  process.exit(1);
}

process.env['RCI_DEVICE_IP'] = argv.addr;

const vitest = spawn(
  'vitest',
  ['run', '--environment', 'node', '--globals'],
  {stdio: 'inherit', env: process.env},
);

vitest.on('exit', code => process.exit(code ?? 1));
