import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {firstValueFrom} from 'rxjs';
import {InspectableAxiosTransport, promptForCredentials} from './common';
import {SessionManager} from '../../src';
import {Ndw4AuthProtocol, SessionAuthContext} from '../../src/session-manager/auth-protocol';

type DeviceResponse = Awaited<ReturnType<InspectableAxiosTransport['inspectAuth']>>;

export const AUTH_SCHEMA = 'x-ndw4-interactive';

export const assertAuth = (status: number, header: string): void => {
  if (status === 200 || status === 301) {
    throw new Error('Device is already authenticated');
  }

  if (status !== 401) {
    throw new Error(`Expected HTTP 401 from device auth endpoint, received HTTP ${status}.`);
  }

  if (!header.includes(AUTH_SCHEMA)) {
    throw new Error(`Device did not advertise "${AUTH_SCHEMA}" auth schema.`);
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

  assertAuth(challengeResponse.status, challengeHeader);
  console.log(`${AUTH_SCHEMA} challenge detected; proceeding...`);

  const sessionManager = new SessionManager<DeviceResponse>(credentials.address, transport);
  const protocol = new Ndw4AuthProtocol<DeviceResponse>(credentials.address, transport);

  const context: SessionAuthContext<DeviceResponse> = {
    isAuthenticated: () => sessionManager.isAuthenticated(),
    errorToResponse: toResponse,
    logError: (error) => console.error(error),
  };

  const result = await firstValueFrom(
    protocol.authenticate(
      challengeResponse,
      context,
      credentials.username,
      credentials.password,
    ),
  );

  if (!result.success) {
    throw new Error(`${AUTH_SCHEMA} authentication failed (${result.reason}).`);
  }

  console.log(`${AUTH_SCHEMA} authentication succeeded.`);
};

const isDirectExecution = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);

      process.exitCode = 1;
    });
}
