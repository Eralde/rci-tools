import {setTimeout as sleep} from 'node:timers/promises';
import {Observable, catchError, firstValueFrom, of, tap, timeout} from 'rxjs';
import {SessionManager, isRciHttpError} from '@rci-tools/core';
import type {LoginDetails} from '@rci-tools/core';
import {InspectableAxiosTransport, promptForCredentials} from './common';
import type {DeviceResponse} from './common';

// below the device handshake lifetime (~20 s)
const ATTEMPT_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 5_000;

// stop once the device has come back and stayed reachable for this many attempts in a row
const STOP_AFTER_SUCCESSES = 5;

// Default is 5 failures within 3 minutes; conservatively track 3 over 5 minutes
const LOCKOUT_WINDOW_MS = 5 * 60_000;
const MAX_COUNTED_FAILURES = 3;

type AttemptOutcome = LoginDetails | {hang: true} | {error: string};
type AttemptKind = 'success' | 'rejected' | 'unavailable' | 'hang' | 'error';

interface RecordedRequest {
  method: string;
  status: number | 'no-response';
  // Axios network errors have no HTTP status; their error code is kept in `RciHttpError.cause`.
  code?: string;
}

// Records the HTTP status of every auth request an attempt makes
class RecordingTransport extends InspectableAxiosTransport {
  public readonly requests: RecordedRequest[] = [];

  public override get(url: string): Observable<DeviceResponse> {
    return super.get(url).pipe(this.record('GET'));
  }

  public override post(url: string, data: unknown): Observable<DeviceResponse> {
    return super.post(url, data).pipe(this.record('POST'));
  }

  private record(method: string) {
    return tap<DeviceResponse>({
      next: (response) => {
        this.requests.push({method, status: response.status});
      },
      error: (error: unknown) => {
        const httpError = isRciHttpError(error) ? error : null;
        const status = httpError?.status ?? 'no-response';
        const cause = httpError?.cause;
        const code = typeof cause === 'object'
            && cause !== null
            && 'code' in cause
            && typeof cause.code === 'string'
          ? cause.code
          : undefined;

        this.requests.push({method, status, ...(code === undefined ? {} : {code})});
      },
    });
  }
}

const formatRequest = (request: RecordedRequest): string => {
  return `${request.method} ${request.status}${request.code ? ` (${request.code})` : ''}`;
};

const toKind = (outcome: AttemptOutcome): AttemptKind => {
  if ('hang' in outcome) {
    return 'hang';
  }

  if ('error' in outcome) {
    return 'error';
  }

  return outcome.success ? 'success' : outcome.reason;
};

// Conservative: every failed attempt that got a real HTTP answer may have been counted by the device
const isCountedFailure = (kind: AttemptKind, requests: RecordedRequest[]): boolean => {
  return kind !== 'success' && requests.some((request) => typeof request.status === 'number');
};

const runAttempt = async (address: string, username: string, password: string) => {
  // fresh transport means a fresh cookie jar: every attempt starts without a session
  const transport = new RecordingTransport();
  const session = new SessionManager<DeviceResponse>(address, transport);

  const outcome = await firstValueFrom(
    session.loginDetailed(username, password)
      .pipe(
        timeout({first: ATTEMPT_TIMEOUT_MS, with: () => of<AttemptOutcome>({hang: true})}),
        catchError((error: unknown) => of<AttemptOutcome>({error: String(error)})),
      ),
  );

  // do not leave a device session behind for every successful attempt
  if (toKind(outcome) === 'success') {
    await firstValueFrom(
      session.logout().pipe(timeout({first: ATTEMPT_TIMEOUT_MS, with: () => of(null)})),
    );
  }

  return {outcome, requests: transport.requests};
};

const main = async (): Promise<void> => {
  const {address, username, password} = await promptForCredentials();
  const counts: Record<AttemptKind, number> = {success: 0, rejected: 0, unavailable: 0, hang: 0, error: 0};
  const countedFailures: number[] = [];

  let hasSeenFailure = false;
  let successesInRow = 0;

  const pruneCountedFailures = (): void => {
    const now = Date.now();

    while (countedFailures[0] !== undefined && now - countedFailures[0] >= LOCKOUT_WINDOW_MS) {
      countedFailures.shift();
    }
  };

  const printSummary = (): void => {
    console.log(`\nSummary: ${JSON.stringify(counts)}`);

    if (counts.rejected > 0) {
      console.log('FAIL: a correct password was reported as "rejected".');
      process.exitCode = 1;
    }

    if (counts.hang > 0) {
      console.log(`NOTE: ${counts.hang} attempt(s) emitted nothing within ${ATTEMPT_TIMEOUT_MS} ms.`);
    }
  };

  process.on(
    'SIGINT',
    () => {
      printSummary();
      process.exit();
    },
  );

  console.log(`\nPolling ${address}/auth every ${POLL_INTERVAL_MS} ms. Reboot the device now; Ctrl+C to stop.`);

  while (!(hasSeenFailure && successesInRow >= STOP_AFTER_SUCCESSES)) {
    pruneCountedFailures();

    const oldestCountedFailure = countedFailures[0];

    if (countedFailures.length >= MAX_COUNTED_FAILURES && oldestCountedFailure !== undefined) {
      const waitMs = oldestCountedFailure + LOCKOUT_WINDOW_MS - Date.now();

      console.log(
        `lockout guard: ${countedFailures.length} counted failures in 5 min, waiting ${Math.ceil(waitMs / 1000)} s`,
      );
      await sleep(Math.max(waitMs, 0));
      continue;
    }

    const startedAt = Date.now();
    const {outcome, requests} = await runAttempt(address, username, password);
    const kind = toKind(outcome);

    counts[kind] += 1;

    if (kind === 'success') {
      successesInRow += 1;
    } else {
      hasSeenFailure = true;
      successesInRow = 0;
    }

    if (isCountedFailure(kind, requests)) {
      countedFailures.push(Date.now());
    }

    console.log(
      [
        new Date().toISOString(),
        kind.padEnd(11),
        ('protocol' in outcome ? outcome.protocol ?? '-' : '-').padEnd(18),
        `${String(Date.now() - startedAt).padStart(6)} ms`,
        requests.map(formatRequest).join(' -> ') || '(no requests finished)',
        'error' in outcome ? outcome.error : '',
      ].join('  '),
    );

    await sleep(POLL_INTERVAL_MS);
  }

  printSummary();
};

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);

    process.exitCode = 1;
  });
