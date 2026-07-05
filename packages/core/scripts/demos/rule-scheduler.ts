import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {firstValueFrom, forkJoin} from 'rxjs';
import {
  FetchTransport,
  RciManager,
  RuleScheduler,
  after,
  pathIncluded,
  queryCountAtLeast,
  type QueryStats,
} from '../../src';
import {normalizeAddress, pause, printStatsEntry} from './utils.js';

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

  const scheduler = new RuleScheduler([
    queryCountAtLeast(3),
    pathIncluded('show.interface'),
    after(100),
  ]);
  const fetchTransport = new FetchTransport();
  const rciManager = new RciManager(host, fetchTransport, {batchScheduler: scheduler});

  rciManager.toggleStats(true);

  console.log('\n=== Rule-Based Scheduler Demo ===');
  console.log(`Target device: ${host}`);
  console.log('Rules:');
  console.log('  1. queryCount >= 3');
  console.log('  2. queryPaths includes "show.interface"');
  console.log('  3. after(100ms)\n');

  const statsLog: Array<QueryStats> = [];
  const statsSub = rciManager.stats$.subscribe((s) => {
    statsLog.push(s);
    printStatsEntry(s);
  });

  // --- Batch 1: queue 2 queries (count=2, no "show.interface") ---
  console.log('--- Batch 1: queueing show.version, show.system (count < 3, no show.interface) ---');
  const b1$ = forkJoin([
    rciManager.queue({path: 'show.version'}),
    rciManager.queue({path: 'show.system'}),
  ]);

  await firstValueFrom(b1$).catch(() => {
  });
  await pause(120);
  console.log('  → Flushed by rule 3 (after 100ms)\n');

  // --- Batch 2: queue show.interface to trigger the priority rule ---
  console.log('--- Batch 2: queueing show.interface (triggers rule 2 immediately) ---');
  const b2$ = rciManager.queue({path: 'show.interface'});
  await firstValueFrom(b2$).catch(() => {
  });
  await pause(50);
  console.log('  → Flushed by rule 2 (show.interface detected)\n');

  // --- Batch 3: queue 4 non-interface queries ---
  console.log('--- Batch 3: queueing 4 non-interface queries (count triggers at 3) ---');
  const b3$ = forkJoin([
    rciManager.queue({path: 'whoami'}),
    rciManager.queue({path: 'show.ip.hotspot'}),
    rciManager.queue({path: 'show.internet.status'}),
    rciManager.queue({path: 'show.identification'}),
  ]);
  await firstValueFrom(b3$).catch(() => {
  });
  await pause(120);
  console.log('  → First 3 flushed by rule 1 (queryCount >= 3), 4th flushed by rule 3 (after 100ms)\n');

  statsSub.unsubscribe();
  rciManager.toggleStats(false);

  console.log('=== Summary ===');
  console.log(`Total batches recorded: ${statsLog.length}`);
  statsLog.forEach((s, i) => {
    console.log(`  Batch ${i + 1}: ${s.queryPaths.join(', ')} — ${s.durationMs.toFixed(2)}ms (${s.queueName})`);
  });

  rciManager.destroy();
};

main().catch(console.error);
