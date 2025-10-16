const {execSync} = require('child_process');
const yargs = require('yargs/yargs');
const {hideBin} = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('host', {
    type: 'string',
    description: 'The remote host for deployment (e.g., user@192.168.1.100)',
    demandOption: true,
  })
  .option('path', {
    type: 'string',
    description: 'The remote path where files will be deployed (e.g., /var/www/html/demo)',
    demandOption: true,
  })
  .option('port', {
    type: 'number',
    description: 'The SSH port for deployment',
    default: 22,
  })
  .help()
  .alias('help', 'h')
  .argv;

const checkCommand = (command) => {
  try {
    execSync(`command -v ${command}`, {stdio: 'ignore'});

    return true;
  } catch (e) {
    return false;
  }
};

const deploy = async () => {
  const {host, path: remotePath, port} = argv;

  console.log('Starting deployment process...\n\n');

  const CMD = 'scp';

  if (!checkCommand(CMD)) {
    console.error(`Error: "${CMD}" command not found. Please ensure OpenSSH client is installed and available in your PATH.`);
    process.exit(1);
  }

  try {
    console.log('1. Building the application...\n');
    execSync('npm run build', {stdio: 'inherit'});
    console.log('Application built successfully.\n\n');

    const scpCommand = `scp -O -P ${port} -r ./dist/* ${host}:${remotePath}`;

    console.log(`2. Copying build files to ${host}:${remotePath} (port: ${port})...\n\n`);
    execSync(scpCommand, {stdio: 'inherit'});
    console.log('Deployment successful!\n\n');
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
};

void deploy();
