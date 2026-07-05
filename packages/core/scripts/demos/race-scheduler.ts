import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {firstValueFrom, forkJoin} from 'rxjs';
import {
  FetchTransport,
  RciManager,
  RuleScheduler,
  TimerScheduler,
  pathIncluded,
  queryCountAtLeast,
  raceSchedulers,
} from '../../src';
import {normalizeAddress, pause} from './utils.js';

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('addr', {
      type: 'string',
      description: 'Device IP address',
      demandOption: true,
      alias: 'a',
    })
    .help()
    .parseSync();

  const host = normalizeAddress(argv.addr);

  const composedScheduler = raceSchedulers(
    new RuleScheduler([
      queryCountAtLeast(3),
      pathIncluded('show.interface'),
    ]),
    new TimerScheduler(200),
  );

  const fetchTransport = new FetchTransport();
  const rciManager = new RciManager(host, fetchTransport, {batchScheduler: composedScheduler});

  console.log('\n=== Race Scheduler Demo ===');
  console.log(`Target device: ${host}`);
  console.log('Scheduler: raceSchedulers( RuleScheduler[count>=3, contains show.interface], TimerScheduler[200ms] )\n');

  // --- Scenario A: queue show.interface → rule wins the race ---
  console.log('--- Scenario A: Priority path wins the race ---');
  console.log('Queueing: show.version, show.system, show.interface');
  const sA = [
    rciManager.queue({path: 'show.version'}),
    rciManager.queue({path: 'show.system'}),
    rciManager.queue({path: 'show.interface'}),
  ];

  const tA = Date.now();
  await firstValueFrom(forkJoin(sA)).catch(() => {
  });
  console.log(`  Completed in ${Date.now() - tA}ms (expected: << 200ms — show.interface rule won)\n`);

  await pause(100);

  // --- Scenario B: count threshold wins the race (no priority path, >= 3 queries) ---
  console.log('--- Scenario B: Count threshold wins the race ---');
  console.log('Queueing: whoami, show.system, show.ip.hotspot (3 queries, no show.interface)');
  const sB = [
    rciManager.queue({path: 'whoami'}),
    rciManager.queue({path: 'show.system'}),
    rciManager.queue({path: 'show.ip.hotspot'}),
  ];

  const tB = Date.now();
  await firstValueFrom(forkJoin(sB)).catch(() => {
  });
  const elapsedB = Date.now() - tB;
  console.log(`  Completed in ${elapsedB}ms (expected: ~0-200ms — count>=3 rule won)\n`);

  await pause(100);

  // --- Scenario C: only 2 queries, no priority path → timer wins the race ---
  console.log('--- Scenario C: Timer wins the race ---');
  console.log('Queueing: show.identification, show.sc.user (only 2 queries, no show.interface)');
  const sC = [
    rciManager.queue({path: 'show.identification'}),
    rciManager.queue({path: 'show.sc.user'}),
  ];

  const tC = Date.now();
  await firstValueFrom(forkJoin(sC)).catch(() => {
  });
  const elapsedC = Date.now() - tC;
  console.log(`  Completed in ${elapsedC}ms (expected: ~200ms — TimerScheduler won)\n`);

  rciManager.destroy();
};

main().catch(console.error);
