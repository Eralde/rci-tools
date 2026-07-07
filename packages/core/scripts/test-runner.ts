#!/usr/bin/env node

import {spawn} from 'child_process';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import process from 'node:process';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('addr', {
    alias: 'a',
    describe: 'Device IP address (runs all tests; omit for unit tests only)',
    type: 'string',
  })
  .option('integration', {
    alias: 'i',
    describe: 'Run only integration tests (requires --addr)',
    type: 'boolean',
    default: false,
  })
  .check((args) => {
    if (args.integration && !args.addr) {
      throw new Error('--addr <device-ip> is required when using --integration');
    }
    return true;
  })
  .help()
  .parseSync();

const vitestArgs = ['run', '--environment', 'node', '--globals'];

if (argv.addr) {
  process.env['RCI_DEVICE_IP'] = argv.addr;
}

if (argv.integration) {
  vitestArgs.push('__tests__/integration');
} else if (argv.addr) {
  vitestArgs.push('__tests__');
} else {
  vitestArgs.push('__tests__/unit');
}

const vitest = spawn('vitest', vitestArgs, {stdio: 'inherit', env: process.env});

vitest.on('exit', code => process.exit(code ?? 1));
