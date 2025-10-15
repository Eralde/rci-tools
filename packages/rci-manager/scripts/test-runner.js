#!/usr/bin/env node

const [,, deviceIp, ...rest] = process.argv;

if (!deviceIp) {
  console.error('Error: You must provide the device IP as the first argument.');
  process.exit(1);
}

process.env.RCI_DEVICE_IP = deviceIp;

// Pass through any additional arguments to vitest
const { spawn } = require('child_process');
const vitest = spawn('vitest', ['run', '--environment', 'node', '--globals', ...rest], { stdio: 'inherit', env: process.env });

vitest.on('exit', code => process.exit(code));
