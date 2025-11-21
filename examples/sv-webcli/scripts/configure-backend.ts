#!/usr/bin/env node
import fs from 'fs';
import {Config, NodeSSH} from 'node-ssh';
import {Prompt} from 'ssh2-streams';
import * as process from 'node:process';
import readlineSync from 'readline-sync';
import path from 'path';
import {executeRemoteCommand, isSshpassInstalled, scpCopy} from './util/ssh.ts';
import {
  LIGHTTPD_CONF,
  LIGHTTPD_CONF_REMOTE_DIR,
  LIGHTTPD_CONF_TEMPLATE,
  LOCAL_OPKG_DATA_DIR,
  PACKAGES_LIST,
  SSH_USER,
} from './conf.ts';
import {config} from './args.ts';

const {sshHost, sshPort, sshKey, httpPort, ttydScriptsDir} = config;

let password = '';

if (!sshKey) {
  console.log('No SSH_KEY configured. You will be prompted for a password.');

  if (!isSshpassInstalled()) {
    // dprint-ignore
    console.error('Error: sshpass is not installed. Please install it to use password-based SSH authentication.');
    process.exit(1);
  }

  password = readlineSync.question('Enter SSH password: ', {hideEchoBack: true});
}

const ssh = new NodeSSH();

const configureBackend = async (): Promise<void> => {
  try {
    const connectConfig: Config = {
      host: sshHost,
      port: sshPort,
      username: SSH_USER,
      tryKeyboard: true,
      onKeyboardInteractive: (
        name: string,
        instructions: string,
        lang: string,
        prompts: Prompt[],
        finish: (responses: string[]) => void,
      ) => {
        if (password) {
          finish([password]); // Provide the stored password for keyboard-interactive prompts
        } else {
          console.error('Keyboard interactive authentication requested, but no password provided.');
          process.exit(1); // Exit if interactive password is required but not available
        }
      },
    };

    if (sshKey) {
      connectConfig.privateKeyPath = sshKey;
    } else if (password) {
      connectConfig.password = password;
    }

    const sshConnStr = `${SSH_USER}@${sshHost}:${sshPort}`;

    console.log(`Connecting to ${sshConnStr}...`);
    await ssh.connect(connectConfig);
    console.log('SSH connection established.');

    console.log('\nStep 1: ensuring required packages are installed');
    try {
      await executeRemoteCommand(ssh, sshHost, 'opkg update', 'Updating opkg package lists');

      const pkgList = PACKAGES_LIST.join(' ');

      await executeRemoteCommand(
        ssh,
        sshHost,
        `opkg install ${pkgList}`,
        'Installing required opkg packages',
      );
    } catch (error) {
      console.error('Failed to install required opkg packages');
      process.exit(1);
    }

    console.log(`\nStep 2: Ensuring remote state and config directory ${ttydScriptsDir} exists on ${sshHost}...`);
    try {
      await executeRemoteCommand(ssh, sshHost, `mkdir -p ${ttydScriptsDir}`, 'Creating remote directory');
      console.log(`Directory for scripts to control ttyd created successfully`);
    } catch (error) {
      console.error('Failed to create remote directory');
      process.exit(1);
    }

    console.log('\nStep 3');
    console.log(`Copying ./opkg/${LIGHTTPD_CONF_TEMPLATE} to ${sshHost}:${LIGHTTPD_CONF_REMOTE_DIR}...`);

    const remoteTemplatePath = `${LIGHTTPD_CONF_REMOTE_DIR}/${LIGHTTPD_CONF_TEMPLATE}`;
    const remoteConfPath = `${LIGHTTPD_CONF_REMOTE_DIR}/${LIGHTTPD_CONF}`;

    try {
      scpCopy(
        sshHost,
        sshPort,
        sshKey,
        password,
        path.join(LOCAL_OPKG_DATA_DIR, LIGHTTPD_CONF_TEMPLATE),
        LIGHTTPD_CONF_REMOTE_DIR,
      );

      console.log(`${LIGHTTPD_CONF_TEMPLATE} copied successfully.`);

      // a) get current `br0` address and replace <DEVICE_HOME_SEGMENT_IP> in the config template with it
      // b) replace <HTTP_PORT> with `httpPortValue`
      const getIpAndFillTemplateCmd = `
        HOME_IP=$(ip -4 addr show br0 | awk '/inet / {print $2}' | cut -d/ -f1) && \
        sed \
            -e "s/<DEVICE_HOME_SEGMENT_IP>/$HOME_IP/g" \
            -e "s/<HTTP_PORT>/${httpPort}/g" \
            ${remoteTemplatePath} > ${remoteConfPath}
      `;

      await executeRemoteCommand(
        ssh,
        sshHost,
        getIpAndFillTemplateCmd,
        `Filling ${LIGHTTPD_CONF} template on ${sshHost}`,
      );
      console.log(`${LIGHTTPD_CONF} filled successfully from template.`);
    } catch (error) {
      console.error(`Failed to copy or process ${LIGHTTPD_CONF_TEMPLATE}`);
      process.exit(1);
    }

    console.log('\nStep 4: Testing lighttpd.conf');
    await executeRemoteCommand(ssh, sshHost, `lighttpd -t -f ${remoteConfPath}`, 'Testing lighttpd configuration');
    await executeRemoteCommand(ssh, sshHost, `/opt/etc/init.d/S80lighttpd restart`, 'Restarting lighttpd');
    console.log('lighttpd is running with the updated configuration');

    console.log('\nStep 5: Copying CGI shell scripts to control ttyd');
    console.log(`Copying all ./opkg/*.sh files to ${sshHost}:${ttydScriptsDir}...`);

    const opkgDir = LOCAL_OPKG_DATA_DIR;
    const extension = '.sh';

    let shFiles: string[] = [];

    try {
      const files = fs.readdirSync(opkgDir);

      shFiles = files.filter((file) => file.endsWith(extension));
    } catch (error) {
      console.log(`"${LOCAL_OPKG_DATA_DIR}" directory not found or inaccessible.`);
      process.exit(1);
    }

    if (shFiles.length === 0) {
      console.log(`No .sh files found in "${LOCAL_OPKG_DATA_DIR}". Skipping.`);
    } else {
      try {
        const source = `${LOCAL_OPKG_DATA_DIR}/*${extension}`;

        scpCopy(sshHost, sshPort, sshKey, password, source, ttydScriptsDir);
        console.log(`${source} files copied to ${ttydScriptsDir} successfully.`);

        console.log('\nSetting execute permissions for copied shell scripts');
        await executeRemoteCommand(
          ssh,
          sshHost,
          `chmod +x ${ttydScriptsDir}/*.sh`,
          `Setting execute permissions for .sh files on ${sshHost}:${ttydScriptsDir}`,
        );
        console.log('Execute permissions set successfully.');
      } catch (error) {
        console.error('Failed to copy or set execute permissions for .sh files.');
      }
    }

    console.log('\n\nDeployment complete.');
  } catch (error) {
    console.error(
      'An error occurred during backend configuration:',
      error instanceof Error ? error.message : error,
    );

    process.exit(1);
  } finally {
    ssh.dispose();
  }
};

configureBackend()
  .catch((error) => {
    console.error('Unhandled error in configureBackend:', error.message);
    process.exit(1);
  });
