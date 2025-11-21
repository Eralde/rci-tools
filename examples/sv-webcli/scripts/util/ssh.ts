import {execSync} from 'child_process';
import {SSH_USER} from '../conf.ts';
import {NodeSSH} from 'node-ssh';

export const executeRemoteCommand = async (
  ssh: NodeSSH,
  sshHost: string,
  command: string,
  description: string,
): Promise<void> => {
  console.log(`${description}: Running "${command}" on ${sshHost}...`);

  try {
    const result = await ssh.execCommand(command);

    if (result.stdout) {
      console.log(result.stdout);
    }

    if (result.code !== 0) {
      if (result.stderr) {
        console.error(`Error during "${command}":\n${result.stderr}`);
      }

      throw new Error(`Command failed with code ${result.code}: ${command}`);
    }

    console.log('Done!\n');
  } catch (error) {
    console.error(`Failed to execute remote command "${command}".`);
    throw error;
  }
};

export const scpCopy = (
  sshHost: string,
  sshPort: number,
  sshKey: string,
  password: string,
  source: string,
  destination: string,
  recursive: boolean = false,
): void => {
  const target = `${SSH_USER}@${sshHost}`;

  let cmd = `scp -O -P "${sshPort}"`;
  let commandPrefix = '';

  if (password && !sshKey) {
    commandPrefix = `sshpass -p "${password}" `;
    cmd += ` -o StrictHostKeyChecking=no`;
  } else if (sshKey) {
    cmd += ` -i "${sshKey}" -o StrictHostKeyChecking=no`;
  }

  if (recursive) {
    cmd += ' -r';
  }

  execSync(`${commandPrefix}${cmd} ${source} "${target}:${destination}"`, {stdio: 'inherit'});
};

export const isSshpassInstalled = (): boolean => {
  try {
    execSync('sshpass -V', {stdio: 'pipe'});

    return true;
  } catch (error) {
    return false;
  }
};
