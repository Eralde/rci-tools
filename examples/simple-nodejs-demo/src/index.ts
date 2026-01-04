import {TimeoutError, catchError, firstValueFrom, forkJoin, of, timeout} from 'rxjs';
import inquirer from 'inquirer';
import {RciQuery} from '@rci-tools/core';
import * as _ from 'lodash';
import {DeviceCredentials, RciService} from './rci.service';

const getTimestampStr = (): string => {
  return new Date().toISOString().split('T')[1]?.slice(0, -1) || '';
};

const logTimestamped = (...args: any[]): void => {
  console.log(`[${getTimestampStr()}]`, ...args);
};

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

const runBackgroundProcess = async (rciService: RciService): Promise<void> => {
  const path: string = 'components.list';

  console.log('\n----------------------------------------------------------\n');
  console.log(`Using "${path}" command with manual start/abort control\n\n`);

  const query: RciQuery = {
    path,
    data: {sandbox: 'stable'},
  };

  // Initialize the background process (but don't start it yet)
  const process = rciService.initBackgroundProcess(path, query.data || {});

  console.log(`Initialized "${path}" process (state: ${process.getState()})`);
  console.log('The background process is not started yet\n');

  // Subscribe to state changes
  process.state$
    .subscribe((state) => {
      logTimestamped(`Process state changed: ${state}`);
    });

  // Subscribe to data updates
  process.data$
    .subscribe((data) => {
      logTimestamped('Received data update:', JSON.stringify(data, null, 2));
    });

  // Subscribe to completion
  process.done$
    .subscribe((reason) => {
      logTimestamped(`Process finished with reason: ${reason}`);
    });

  // Wait a bit before starting
  console.log('Waiting 1 second before starting the process...\n');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Manually start the process
  console.log('Starting the process manually...\n');
  const started = process.start();

  if (!started) {
    console.error('Failed to start the process');
    return;
  }

  // Wait for the process to complete
  console.log('Waiting for the process to complete...\n');
  await firstValueFrom(process.done$);

  console.log('\n----------------------------------------------------------\n');
  console.log('Summary:\n');
  console.log(`✓ Process was initialized but not started automatically`);
  console.log(`✓ Process was manually started using process.start()`);
  console.log(`✓ Process completed successfully\n`);
};

const queueBackgroundProcesses = async (rciService: RciService): Promise<void> => {
  const path: string = 'tools.ping';

  console.log('\n----------------------------------------------------------\n');
  console.log('\nDemonstrating queuing of background processes for the same command\n');
  console.log(`All "${path}" processes will be queued and executed sequentially\n\n`);

  // Create multiple ping queries with different arguments
  // They all share the same path "tools.ping", so they will be queued together
  const pingQueries: Array<{query: RciQuery; description: string; timeout?: number}> = [
    {
      query: {path, data: {host: 'google.com', packetsize: 84, count: 3}},
      description: 'Ping #1: google.com (3 packets)',
    },
    {
      query: {path, data: {host: 'github.com', packetsize: 84, count: 5}},
      description: 'Ping #2: github.com (5 packets)',
    },
    {
      query: {path, data: {host: 'stackoverflow.com', packetsize: 84, count: 4}},
      description: 'Ping #3: stackoverflow.com (4 packets)',
      timeout: 2000, // This one will timeout after 2 seconds
    },
    {
      query: {path, data: {host: 'example.com', packetsize: 84, count: 10}},
      description: 'Ping #4: example.com (10 packets)',
    },
    {
      query: {path, data: {host: 'wikipedia.org', packetsize: 84, count: 3}},
      description: 'Ping #5: wikipedia.org (3 packets)',
    },
  ];

  console.log(`Queuing ping processes (all share the same path "${path}"):\n`);

  pingQueries.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.description}`);
  });

  console.log('');

  // Queue all processes - they will be executed sequentially
  const pingTasks = pingQueries.map((item, index) => {
    const process = rciService.queueBackgroundProcess(
      item.query.path,
      item.query.data || {},
      item.timeout ? {timeout: item.timeout} : {},
    );

    process.state$
      .subscribe((state) => {
        const hostPart = item.description.split(':')[1]?.trim() || item.description;

        logTimestamped(`Ping #${index + 1} (${hostPart}) state: ${state}`);
      });

    // data updates
    process.data$
      .subscribe(() => {
        logTimestamped(`Ping #${index + 1} received data update`);
      });

    return {task: process, description: item.description, index};
  });

  // manually abort process #2 after waiting for process #1 to complete + 1 second
  pingTasks[0]!.task.done$.subscribe(
    () => {
      console.log('\n[!] Manually aborting process #2 after 1 second [!]\n');

      setTimeout(() => {
        const process2 = pingTasks[1];

        if (process2 && (process2.task.getState() === 'RUNNING' || process2.task.getState() === 'QUEUED')) {
          process2.task.abort();
        }
      }, 1000);
    },
  );

  // wait for all processes to complete
  const done$ = pingTasks.map((item) => item.task.done$);

  console.log(`\nWaiting for all "${path}" processes to complete...\n`);

  const finalResults = await firstValueFrom(forkJoin(done$));

  console.log('\n----------------------------------------------------------\n');
  console.log('Final results for queued ping processes:\n');
  console.log('(Demonstrating sequential execution order and abort/timeout handling)\n');

  pingQueries.forEach((item, index) => {
    const finishReason = finalResults[index];
    const chunks = [
      `${path} #${index + 1}: ${_.padEnd(item.description, 45, ' ')}`,
      `Finish: ${_.padStart(finishReason, 12, ' ')}`,
    ];

    console.log(chunks.join(' | '));
  });

  console.log('\n----------------------------------------------------------\n');
  console.log('Summary:\n');
  console.log(`✓ Only one "${path}" process ran at a time (sequential execution)`);
  console.log('✓ Processes were executed in the order they were queued');
  console.log(`✓ "${path}" #2 was manually aborted`);
  console.log(`✓ "${path}" #3 timed out after 2 seconds`);
  console.log('✓ All processes completed (either DONE, ABORTED, or TIMED_OUT)\n');
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
      await runBackgroundProcess(rciService);
      await queueBackgroundProcesses(rciService);
    });
};

void main();
