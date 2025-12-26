import {catchError, firstValueFrom, forkJoin, of, timeout, TimeoutError} from 'rxjs';
import inquirer from 'inquirer';
import {RciQuery} from '@rci-tools/base';
import * as _ from 'lodash';
import {DeviceCredentials, RciService} from './rci.service';

const getDeviceCredentials = async (): Promise<DeviceCredentials> => {
  return inquirer
    .prompt([
      {
        type: 'input',
        name: 'address',
        message: 'Enter device IPv4 address:',
        default: '192.168.1.1',
        filter(input: any): string {
          return String(input).startsWith('http://')
            ? input
            : `http://${input}`;
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
      },
    ]);
};

const executeRegularQueries = async (rciService: RciService): Promise<void> => {
  console.log('\nExecuting a single RCI query\n');

  const showVersion = await firstValueFrom(rciService.execute({path: 'show.version'}));

  console.log('Response:', showVersion);
  console.log('\b----------------------------------------------------------\n');

  console.log('\nExecuting multiple RCI queries (batching)');

  const [showIdentification, descriptionReset] = await firstValueFrom(
    forkJoin([
      rciService.execute({path: 'show.last-change'}),
      rciService.execute({path: 'system', data: {description: {no: true}}}),
    ]),
  );

  console.log('Responses:', [showIdentification, descriptionReset]);
  console.log('\b----------------------------------------------------------\n');
};

const executeContinuedQueries = async (rciService: RciService): Promise<void> => {
  console.log('\n----------------------------------------------------------\n');
  console.log('\n\nQueuing "continued" queries\n\n');

  const continuedQueries: RciQuery[] = [
    {path: 'tools.ping', data: {host: 'google.com', packetsize: 84, count: 5}},
    {path: 'tools.ping', data: {host: 'google.com', packetsize: 84, count: 5}},
    {path: 'components.list', data: {sandbox: 'stable'}},
    {path: 'components.list', data: {sandbox: 'draft'}},
  ];

  const continuedTasks = continuedQueries.map((query) => {
    return rciService.queueBackgroundProcess(query.path, query.data || {});
  });

  setTimeout(
    () => {
      console.log('\n[!] Manually aborting two "continued" tasks [!]\n');

      continuedTasks[0]!.abort();
      continuedTasks[2]!.abort();
    },
    500,
  );

  const done$ = continuedTasks
    .map((task) => task.done$);

  const finalResults = await firstValueFrom(forkJoin(done$));

  console.log('\nFinal results for "continued" queries:\n');
  continuedQueries.forEach((query, index) => {
    const chunks = [
      `- Query: ${_.padStart(query.path, 20, ' ')}`,
      `Data: ${_.padStart(JSON.stringify(query.data || {}), 50, ' ')}`,
      `Finish reason: ${finalResults[index]}`,
    ];

    console.warn(chunks.join(' | '));
  });
};

const main = async (): Promise<void> => {
  const credentials = await getDeviceCredentials();
  const rciService = new RciService(credentials);

  rciService.ensureAuth()
    .pipe(
      timeout(3000),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          console.log('Auth attempt timed out', error);

          return of(false);
        }

        console.log('Auth failed', error);

        return of(false);
      }),
    )
    .subscribe(async (isAuthenticated) => {
      if (!isAuthenticated) {
        console.warn(
          `Failed to authenticate with username="${credentials.username}" and password="${credentials.password}"`,
        );

        process.exit(0);
      }

      await executeRegularQueries(rciService);
      await executeContinuedQueries(rciService);
    });
}

void main();
