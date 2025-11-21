#!/usr/bin/env node
import fs from 'fs';
import {Config, NodeSSH} from 'node-ssh';
import {Prompt} from 'ssh2-streams';
import * as process from 'node:process';
import readlineSync from 'readline-sync';
import path from 'path';
import {execSync} from 'child_process';
import {executeRemoteCommand, isSshpassInstalled, scpCopy} from './util/ssh';
import {ROOT_DIR, SSH_USER} from './conf';
import {config} from './args';

const {sshHost, sshPort, sshKey, remoteWwwRoot} = config;
const DIST_DIR = path.join(ROOT_DIR, 'dist');

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

const deployFrontend = async (): Promise<void> => {
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

    console.log('\nStep 1: Building project');
    try {
      console.log('Running build command...');
      execSync('npm run build', {cwd: ROOT_DIR, stdio: 'inherit'});
      console.log('Build completed successfully.');
    } catch (error) {
      console.error('Failed to build project');
      process.exit(1);
    }

    if (!fs.existsSync(DIST_DIR)) {
      console.error(`Error: ${DIST_DIR} directory does not exist after build.`);
      process.exit(1);
    }

    console.log(`\nStep 2: Ensuring remote directory ${remoteWwwRoot} exists on ${sshHost}...`);
    try {
      await executeRemoteCommand(ssh, sshHost, `mkdir -p ${remoteWwwRoot}`, 'Creating remote directory');
      console.log(`Remote directory ${remoteWwwRoot} created/verified successfully`);
    } catch (error) {
      console.error('Failed to create remote directory');
      process.exit(1);
    }

    console.log(`\nStep 3: Copying ./dist contents to ${sshHost}:${remoteWwwRoot}...`);
    try {
      scpCopy(sshHost, sshPort, sshKey, password, `${DIST_DIR}/*`, remoteWwwRoot, true);
      console.log(`\nAll files from ${DIST_DIR} copied to ${remoteWwwRoot} successfully.`);
    } catch (error) {
      console.error(`Failed to copy dist contents to ${remoteWwwRoot}`);
      throw error;
    }

    console.log('\n\nDeployment complete.');
  } catch (error) {
    console.error(
      'An error occurred during frontend deployment:',
      error instanceof Error ? error.message : error,
    );

    process.exit(1);
  } finally {
    ssh.dispose();
  }
};

deployFrontend()
  .catch((error) => {
    console.error('Unhandled error in deployFrontend:', error.message);
    process.exit(1);
  });
