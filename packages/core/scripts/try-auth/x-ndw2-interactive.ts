import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {firstValueFrom} from 'rxjs';
import {InspectableAxiosTransport, promptForCredentials} from './common';
import {SessionManager} from '../../src';
import {Ndw2InteractiveAuthProtocol, SessionAuthContext} from '../../src/session-manager/auth-protocol';

type DeviceResponse = Awaited<ReturnType<InspectableAxiosTransport['inspectAuth']>>;

export const NDW2_AUTH_SCHEME = 'x-ndw2-interactive';

export const assertNdw2Challenge = (status: number, header: string): void => {
  if (status === 200) {
    throw new Error('Device is already authenticated; no NDW2 challenge was returned.');
  }

  if (status !== 401) {
    throw new Error(`Expected HTTP 401 from device auth endpoint, received HTTP ${status}.`);
  }

  if (!header.includes(NDW2_AUTH_SCHEME)) {
    throw new Error(`Device did not advertise "${NDW2_AUTH_SCHEME}" auth schema.`);
  }
};

const toResponse = (error: unknown): DeviceResponse => {
  if (
    error
    && typeof error === 'object'
    && 'response' in error
    && error.response
  ) {
    return error.response as DeviceResponse;
  }

  return error as DeviceResponse;
};

const main = async (): Promise<void> => {
  const credentials = await promptForCredentials();

  const transport = new InspectableAxiosTransport();
  const authUrl = `${credentials.address}/auth`;

  console.log(`\nChecking ${authUrl}`);

  const challengeResponse = await transport.inspectAuth(authUrl);
  const challengeHeader = transport.getHeader(challengeResponse, 'WWW-Authenticate');

  console.log(`HTTP status: ${challengeResponse.status}`);
  console.log(`WWW-Authenticate: ${challengeHeader || '(missing)'}`);

  assertNdw2Challenge(challengeResponse.status, challengeHeader);
  console.log('NDW2 challenge detected; forcing legacy login handshake...');

  const sessionManager = new SessionManager<DeviceResponse>(credentials.address, transport);
  const protocol = new Ndw2InteractiveAuthProtocol<DeviceResponse>(credentials.address, transport);

  const context: SessionAuthContext<DeviceResponse> = {
    isAuthenticated: () => sessionManager.isAuthenticated(),
    errorToResponse: toResponse,
    logError: (error) => console.error(error),
  };

  const authenticated = await firstValueFrom(
    protocol.authenticate(
      challengeResponse,
      context,
      credentials.username,
      credentials.password,
    ),
  );

  if (!authenticated) {
    throw new Error('NDW2 authentication failed.');
  }

  console.log('NDW2 authentication succeeded.');
};

const isDirectExecution = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
