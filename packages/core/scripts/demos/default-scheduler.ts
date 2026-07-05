import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {firstValueFrom, forkJoin} from 'rxjs';
import {FetchTransport, RciManager, type RciQuery} from '../../src';
import {normalizeAddress, QUERIES} from './utils.js';

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
  const fetchTransport = new FetchTransport();
  const rciManager = new RciManager(host, fetchTransport);

  console.log('\n=== Default Scheduler Demo ===');
  console.log(`Target device: ${host}`);
  console.log('Scheduler: TimerScheduler(20ms) — the built-in default\n');

  const queries: Array<RciQuery> = QUERIES.slice(0, 5);
  console.log(`Queueing ${queries.length} queries rapidly:`);
  queries.forEach((q) => console.log(`  ${q.path}`));

  const t0 = Date.now();
  await firstValueFrom(forkJoin(queries.map((q) => rciManager.queue(q))));
  const elapsed = Date.now() - t0;

  console.log(`\nAll ${queries.length} queries completed in ${elapsed}ms`);
  console.log('They were batched into a single request by the default TimerScheduler.');

  rciManager.destroy();
};

main().catch(console.error);
