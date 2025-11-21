import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {ENV_DEFAULTS} from '../env.defaults';
import {
  ENV_FILE,
  OPTION_TO_ENV,
  ARG_DEVICE_ADDR,
  ARG_SSH_HOST,
  ARG_SSH_PORT,
  ARG_SSH_KEY,
  ARG_HTTP_PORT,
  ARG_REMOTE_WWW_ROOT,
  ARG_TTYD_PORT,
  ARG_TTYD_SCRIPTS_DIR,
} from './conf';
import fs from 'fs';
import path from 'path';
import os from 'os';

if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const argv = yargs(hideBin(process.argv))
  .version(false)
  .option(
    ARG_DEVICE_ADDR,
    {
      type: 'string',
      description: 'Device IP address',
      default: process.env[OPTION_TO_ENV[ARG_DEVICE_ADDR]],
    },
  )
  .option(
    ARG_SSH_HOST,
    {
      type: 'string',
      description: 'SSH host IP address (defaults to device-addr)',
      default: process.env[OPTION_TO_ENV[ARG_SSH_HOST]],
    },
  )
  .option(
    ARG_SSH_PORT,
    {
      type: 'number',
      description: 'SSH port',
      default: Number(process.env[OPTION_TO_ENV[ARG_SSH_PORT]]) || ENV_DEFAULTS.SSH_PORT,
    },
  )
  .option(
    ARG_SSH_KEY,
    {
      type: 'string',
      description: 'Path to SSH private key',
      default: process.env[OPTION_TO_ENV[ARG_SSH_KEY]],
    },
  )
  .option(
    ARG_HTTP_PORT,
    {
      type: 'number',
      description: 'HTTP port for the backend service',
      default: Number(process.env[OPTION_TO_ENV[ARG_HTTP_PORT]]) || ENV_DEFAULTS.HTTP_PORT,
    },
  )
  .option(
    ARG_REMOTE_WWW_ROOT,
    {
      type: 'string',
      description: 'Remote directory for frontend files',
      default: process.env[OPTION_TO_ENV[ARG_REMOTE_WWW_ROOT]] || ENV_DEFAULTS.REMOTE_WWW_ROOT,
    },
  )
  .option(
    ARG_TTYD_PORT,
    {
      type: 'number',
      description: 'Port for ttyd WebSocket server',
      default: Number(process.env[OPTION_TO_ENV[ARG_TTYD_PORT]]) || ENV_DEFAULTS.TTYD_PORT,
    },
  )
  .option(
    ARG_TTYD_SCRIPTS_DIR,
    {
      type: 'string',
      description: 'Remote directory for ttyd control scripts',
      default: process.env[OPTION_TO_ENV[ARG_TTYD_SCRIPTS_DIR]] || ENV_DEFAULTS.TTYD_SCRIPTS_DIR,
    },
  )
  .help()
  .alias('h', 'help')
  .parseSync();

const isBuildCommand = process.argv.includes('build');
const isPreviewCommand = process.argv.includes('preview');

if (!argv.deviceAddr && !isBuildCommand && !isPreviewCommand) {
  console.error(
    `Error: Device address is required. Please provide it via --${ARG_DEVICE_ADDR} argument or ${OPTION_TO_ENV[ARG_DEVICE_ADDR]} in .env file.`,
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
