import {isIP} from 'node:net';
import inquirer from 'inquirer';
import {AxiosTransport} from '@rci-tools/adapter-axios';

export interface DeviceCredentials {
  address: string;
  username: string;
  password: string;
}

const isIpAddress = (address: string): boolean => {
  if (isIP(address) !== 0) {
    return true;
  }

  try {
    const maybeIp = new URL(address).hostname;

    return isIP(maybeIp) !== 0;
  } catch {
    return false;
  }
};

export const normalizeDeviceAddress = (address: string): string => {
  const trimmedAddress = address
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!trimmedAddress) {
    throw new Error('Device address is required.');
  }

  if (/^https?:\/\//i.test(trimmedAddress)) {
    return trimmedAddress;
  }

  if (isIpAddress(trimmedAddress)) {
    return `http://${trimmedAddress}`;
  }

  return `https://${trimmedAddress}`;
};

export const promptForCredentials = async (): Promise<DeviceCredentials> => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter device IPv4 address or URL:',
      default: '192.168.38.11',
      filter(input: string): string {
        return normalizeDeviceAddress(input);
      },
    },
    {
      type: 'input',
      name: 'username',
      message: 'Enter username:',
      default: 'admin',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter password:',
      mask: '*',
    },
  ]);

  return {
    address: normalizeDeviceAddress(String(answers.address)),
    username: String(answers.username),
    password: String(answers.password),
  };
};

export class InspectableAxiosTransport extends AxiosTransport {
  public inspectAuth(url: string) {
    return this.client.get(
      url,
      {
        validateStatus: () => true,
        withCredentials: true,
      },
    );
  }
}

export type DeviceResponse = Awaited<ReturnType<InspectableAxiosTransport['inspectAuth']>>;
