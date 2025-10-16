const {execSync} = require('child_process');
const yargs = require('yargs/yargs');
const {hideBin} = require('yargs/helpers');

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
  const {proxyAddr} = argv;

  let command = 'vite';

  if (proxyAddr) {
    // Pass PROXY_ADDR as an environment variable to the vite process
    command = `PROXY_ADDR=${proxyAddr} ${command}`;
    console.log(`[Dev Runner]: Using proxy address from CLI: ${proxyAddr}`);
  } else {
    console.log('[Dev Runner]: No proxy address specified via CLI, using PROXY_ADDR from .env as fallback');
  }

  try {
    console.log(`[Dev Runner]: Running command: ${command}`);
    execSync(command, {stdio: 'inherit'});
  } catch (error) {
    console.error('[Dev Runner]: Vite development server failed:', error.message);
    process.exit(1);
  }
};

void runDev();
