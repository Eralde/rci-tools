import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import fs from 'fs';
import {
  ARG_DEVICE_ADDR,
  ARG_HTTP_PORT,
  ARG_REMOTE_WWW_ROOT,
  ARG_SSH_HOST,
  ARG_SSH_KEY,
  ARG_SSH_PORT,
  ARG_TTYD_PORT,
  ARG_TTYD_SCRIPTS_DIR,
  ENV_FILE,
  ENV_TO_OPTION,
  OPTION_TO_ENV,
} from './conf';
import {ENV_DEFAULTS} from '../env.defaults';

interface EnvFile {
  [key: string]: string;
}

function readEnvFile(): EnvFile {
  if (!fs.existsSync(ENV_FILE)) {
    return {};
  }

  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const env: EnvFile = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);

    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      env[key] = value;
    }
  }

  return env;
}

function writeEnvFile(env: EnvFile): void {
  const lines: string[] = [];
  const sortedKeys = Object.keys(env).sort();

  for (const key of sortedKeys) {
    lines.push(`${key}=${env[key]}`);
  }

  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', 'utf-8');
}

function listCommand(): void {
  const env = readEnvFile();

  // Show all variables that have either a .env value or a default value
  const allOptions = Object.keys(OPTION_TO_ENV).sort();

  let hasAnyOutput = false;

  for (const optionName of allOptions) {
    const envKey = OPTION_TO_ENV[optionName];
    const envValue = env[envKey];
    const defaultValue = (ENV_DEFAULTS as any)[envKey];

    if (envValue !== undefined) {
      console.log(`--${optionName} = ${envValue}`);
      hasAnyOutput = true;
    } else if (defaultValue !== undefined) {
      console.log(`--${optionName} = ${defaultValue} (default)`);
      hasAnyOutput = true;
    }
  }

  // Show any .env variables that don't have a corresponding option
  for (const [envKey, value] of Object.entries(env)) {
    if (!ENV_TO_OPTION[envKey]) {
      console.log(`${envKey} = ${value}`);

      hasAnyOutput = true;
    }
  }

  if (!hasAnyOutput) {
    console.log('No configuration values set.');
  }
}

function setCommand(argv: yargs.ArgumentsCamelCase): void {
  const env = readEnvFile();

  let updated = false;

  for (const [optionName, envKey] of Object.entries(OPTION_TO_ENV)) {
    const camelCaseName = optionName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = (argv as any)[camelCaseName];

    if (value !== undefined && value !== null && value !== '') {
      env[envKey] = String(value);
      updated = true;

      console.log(`Set --${optionName} = ${value}`);
    }
  }

  if (updated) {
    writeEnvFile(env);
  } else {
    console.error('Error: No values provided to set.');
    process.exit(1);
  }
}

function deleteCommand(argv: yargs.ArgumentsCamelCase): void {
  const env = readEnvFile();

  let deleted = false;

  for (const [optionName, envKey] of Object.entries(OPTION_TO_ENV)) {
    const camelCaseName = optionName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const shouldDelete = (argv as any)[camelCaseName];

    if (shouldDelete !== undefined && shouldDelete !== null) {
      if (env[envKey]) {
        delete env[envKey];

        deleted = true;

        console.log(`Deleted --${optionName}`);
      } else {
        console.log(`--${optionName} is not set`);
      }
    }
  }

  if (deleted) {
    writeEnvFile(env);
  } else {
    console.error('Error: No variables specified to delete.');
    process.exit(1);
  }
}

yargs(hideBin(process.argv))
  .scriptName('cfg')
  .command(
    'list',
    'List all current configuration values',
    (yargs) => yargs,
    () => listCommand(),
  )
  .command(
    'set',
    'Set configuration values',
    (yargs) => {
      return yargs
        .option(
          ARG_DEVICE_ADDR,
          {
            type: 'string',
            description: 'Device IP address',
          },
        )
        .option(
          ARG_SSH_HOST,
          {
            type: 'string',
            description: 'SSH host IP address',
          },
        )
        .option(
          ARG_SSH_PORT,
          {
            type: 'number',
            description: 'SSH port',
          },
        )
        .option(
          ARG_SSH_KEY,
          {
            type: 'string',
            description: 'Path to SSH private key',
          },
        )
        .option(
          ARG_HTTP_PORT,
          {
            type: 'number',
            description: 'HTTP port for the backend service',
          },
        )
        .option(
          ARG_REMOTE_WWW_ROOT,
          {
            type: 'string',
            description: 'Remote directory for frontend files',
          },
        )
        .option(
          ARG_TTYD_PORT,
          {
            type: 'number',
            description: 'Port for ttyd WebSocket server',
          },
        )
        .option(
          ARG_TTYD_SCRIPTS_DIR,
          {
            type: 'string',
            description: 'Remote directory for ttyd control scripts',
          },
        );
    },
    (argv) => setCommand(argv),
  )
  .command(
    'delete',
    'Delete configuration values',
    (yargs) => {
      return yargs
        .option(
          ARG_DEVICE_ADDR,
          {
            type: 'boolean',
            description: 'Delete device-addr',
          },
        )
        .option(
          ARG_SSH_HOST,
          {
            type: 'boolean',
            description: 'Delete ssh-host',
          },
        )
        .option(
          ARG_SSH_PORT,
          {
            type: 'boolean',
            description: 'Delete ssh-port',
          },
        )
        .option(
          ARG_SSH_KEY,
          {
            type: 'boolean',
            description: 'Delete ssh-key',
          },
        )
        .option(
          ARG_HTTP_PORT,
          {
            type: 'boolean',
            description: 'Delete http-port',
          },
        )
        .option(
          ARG_REMOTE_WWW_ROOT,
          {
            type: 'boolean',
            description: 'Delete remote-www-root',
          },
        )
        .option(
          ARG_TTYD_PORT,
          {
            type: 'boolean',
            description: 'Delete ttyd-port',
          },
        )
        .option(
          ARG_TTYD_SCRIPTS_DIR,
          {
            type: 'boolean',
            description: 'Delete ttyd-scripts-dir',
          },
        );
    },
    (argv) => deleteCommand(argv),
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('h', 'help')
  .parseSync();
