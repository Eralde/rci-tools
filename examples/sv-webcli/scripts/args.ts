import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {ENV_DEFAULTS} from '../env.defaults.ts';
import {ENV_FILE} from './conf.ts';
import fs from 'fs';
import path from 'path';
import os from 'os';

if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const argv = yargs(hideBin(process.argv))
  .version(false)
  .option(
    'device-addr',
    {
      type: 'string',
      description: 'Device IP address',
      default: process.env.DEVICE_ADDR,
    },
  )
  .option(
    'ssh-host',
    {
      type: 'string',
      description: 'SSH host IP address (defaults to device-addr)',
      default: process.env.SSH_HOST,
    },
  )
  .option(
    'ssh-port',
    {
      type: 'number',
      description: 'SSH port',
      default: Number(process.env.SSH_PORT) || ENV_DEFAULTS.SSH_PORT,
    },
  )
  .option(
    'ssh-key',
    {
      type: 'string',
      description: 'Path to SSH private key',
      default: process.env.SSH_KEY,
    },
  )
  .option(
    'http-port',
    {
      type: 'number',
      description: 'HTTP port for the backend service',
      default: Number(process.env.HTTP_PORT) || ENV_DEFAULTS.HTTP_PORT,
    },
  )
  .option(
    'remote-www-root',
    {
      type: 'string',
      description: 'Remote directory for frontend files',
      default: process.env.REMOTE_WWW_ROOT || ENV_DEFAULTS.REMOTE_WWW_ROOT,
    },
  )
  .option(
    'ttyd-port',
    {
      type: 'number',
      description: 'Port for ttyd WebSocket server',
      default: Number(process.env.TTYD_PORT) || ENV_DEFAULTS.TTYD_PORT,
    },
  )
  .option(
    'ttyd-scripts-dir',
    {
      type: 'string',
      description: 'Remote directory for ttyd control scripts',
      default: process.env.TTYD_SCRIPTS_DIR || ENV_DEFAULTS.TTYD_SCRIPTS_DIR,
    },
  )
  .help()
  .alias('h', 'help')
  .parseSync();

const isBuildCommand = process.argv.includes('build');
const isPreviewCommand = process.argv.includes('preview');

if (!argv.deviceAddr && !isBuildCommand && !isPreviewCommand) {
  console.error(
    'Error: Device address is required. Please provide it via --device-addr argument or DEVICE_ADDR in .env file.',
  );
  process.exit(1);
}

const sshHost = argv.sshHost || argv.deviceAddr || '';
const sshPort = argv.sshPort;

let sshKey = '';

if (argv.sshKey) {
  const homeAlias = '~' + path.sep;
  const home = os.homedir() + path.sep;
  const privateKeyPath = argv.sshKey;

  sshKey = privateKeyPath.startsWith(homeAlias)
    ? home + privateKeyPath.slice(homeAlias.length)
    : privateKeyPath;
}

export const config = {
  deviceAddr: argv.deviceAddr,
  sshHost,
  sshPort,
  sshKey,
  httpPort: argv.httpPort,
  remoteWwwRoot: argv.remoteWwwRoot,
  ttydPort: argv.ttydPort,
  ttydScriptsDir: argv.ttydScriptsDir,
};
