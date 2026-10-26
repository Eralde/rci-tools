import {isIP} from 'node:net';
import inquirer from 'inquirer';
import {firstValueFrom} from 'rxjs';
import {AxiosTransport} from '@rci-tools/adapter-axios';
import {SessionManager} from '@rci-tools/core';
import type {AuthProtocolName} from '@rci-tools/core';

export interface DeviceCredentials {
  address: string;
  username: string;
  password: string;
}

// An explicit scheme is kept. Otherwise, an IP address (with or without a port) gets `http://`, a hostname `https://`.
export const normalizeDeviceAddress = (address: string): string => {
  const trimmedAddress = address.trim().replace(/\/+$/, '');

  if (!trimmedAddress) {
    throw new Error('Device address is required.');
  }

  if (/^https?:\/\//i.test(trimmedAddress)) {
    return trimmedAddress;
  }

  // a bare IPv6 address needs brackets in a URL
  if (isIP(trimmedAddress) === 6) {
    return `http://[${trimmedAddress}]`;
  }

  let hostname: string;

  try {
    hostname = new URL(`http://${trimmedAddress}`).hostname;
  } catch {
    throw new Error(`Invalid device address: ${trimmedAddress}`);
  }

  // `URL` keeps IPv6 hostnames in brackets
  const isIpHost = isIP(hostname.replace(/^\[(.*)\]$/, '$1')) !== 0;

  return `${isIpHost ? 'http' : 'https'}://${trimmedAddress}`;
};

export const promptForCredentials = async (): Promise<DeviceCredentials> => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter device IP address or URL:',
      default: '192.168.1.1',
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
    return this.client.get(url, {validateStatus: () => true, withCredentials: true});
  }
}

export type DeviceResponse = Awaited<ReturnType<InspectableAxiosTransport['inspectAuth']>>;

export const runProtocolCheck = async (
  protocol: AuthProtocolName,
  authenticatedStatuses: readonly number[],
): Promise<void> => {
  const {address, username, password} = await promptForCredentials();
  const transport = new InspectableAxiosTransport();
  const authUrl = `${address}/auth`;

  console.log(`\nChecking ${authUrl}`);

  const challengeResponse = await transport.inspectAuth(authUrl);
  const challengeHeader = transport.getHeader(challengeResponse, 'WWW-Authenticate');

  console.log(`HTTP status: ${challengeResponse.status}`);
  console.log(`WWW-Authenticate: ${challengeHeader ?? '(missing)'}`);

  if (authenticatedStatuses.includes(challengeResponse.status)) {
    throw new Error('Device is already authenticated');
  }

  if (challengeResponse.status !== 401) {
    throw new Error(`Expected HTTP 401 from device auth endpoint, received HTTP ${challengeResponse.status}.`);
  }

  if (!challengeHeader?.includes(protocol)) {
    throw new Error(`Device did not advertise "${protocol}" auth schema.`);
  }

  const sessionManager = new SessionManager(address, transport, {protocols: [protocol]});
  const details = await firstValueFrom(sessionManager.loginDetailed(username, password));

  if (!details.success || details.protocol !== protocol) {
    const reason = details.success ? 'protocol mismatch' : details.reason;

    throw new Error(`${protocol} authentication failed (${reason}).`);
  }

  console.log(`${protocol} authentication succeeded.`);
};
