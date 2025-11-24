const {execSync} = require('child_process');
const yargs = require('yargs/yargs');
const {hideBin} = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const {loadEnvFile} = require('node:process');

const DOTENV = path.join(__dirname, '..', '.env');

const argv = yargs(hideBin(process.argv))
  .option(
    'proxy-addr',
    {
      type: 'string',
      description: 'Device IP address to proxy requests to (e.g., 192.168.1.1)',
      alias: 'a',
    },
  )
  .help()
  .alias('help', 'h')
  .argv;

const runDev = () => {
  if (fs.existsSync(DOTENV)) {
    loadEnvFile(DOTENV);
  }

  let proxyAddr;
  let command = 'vite';

  if (argv.proxyAddr) {
    proxyAddr = argv.proxyAddr;

    console.log(`[Dev Runner]: Using proxy address from CLI: ${proxyAddr}`);
  } else {
    proxyAddr = process.env.PROXY_ADDR;

    console.log(`[Dev Runner]: No proxy address specified via CLI, using PROXY_ADDR from .env as fallback: ${proxyAddr}`);
  }

  if (!proxyAddr) {
    console.warn('[Dev Runner]: device proxy address is not specified. Stopping...');
    process.exit(0);
  }

  try {
    console.log(`[Dev Runner]: Running command: ${command}`);
    execSync(command, {stdio: 'inherit', env: {PROXY_ADDR: proxyAddr}});
  } catch (error) {
    console.error('[Dev Runner]: Vite development server failed:', error.message);
    process.exit(1);
  }
};

void runDev();
