import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {firstValueFrom, forkJoin} from 'rxjs';
import {FetchTransport, RciManager, TimerScheduler} from '../../src';
import {normalizeAddress} from './utils.js';

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

  // Start with fast scheduler (immediate flush)
  const rciManager = new RciManager(host, fetchTransport, {
    batchScheduler: new TimerScheduler(0),
  });

  console.log('\n=== Runtime Scheduler Switch Demo ===');
  console.log(`Target device: ${host}\n`);

  // --- Phase 1: Fast scheduler — immediate flush ---
  console.log('--- Phase 1: TimerScheduler(0) — immediate flush ---');
  console.log('Queueing: show.version, show.system, whoami');

  const t1Start = Date.now();
  await firstValueFrom(forkJoin([
    rciManager.queue({path: 'show.version'}),
    rciManager.queue({path: 'show.system'}),
    rciManager.queue({path: 'whoami'}),
  ])).catch(() => {
  });
  const p1 = Date.now() - t1Start;
  console.log(`  Completed in ${p1}ms (expected: near-immediate flush plus device/network time)\n`);

  // --- Phase 2: Swap to slow scheduler ---
  console.log('--- Phase 2: Swapping to TimerScheduler(5000ms) ---');
  await firstValueFrom(rciManager.replaceBatchScheduler(new TimerScheduler(5000)));
  console.log('  Scheduler swapped successfully.\n');

  // --- Phase 3: Slow scheduler — 5 second wait ---
  console.log('--- Phase 3: TimerScheduler(5000ms) — slow 5-second batch ---');
  console.log('Queueing: show.ip.hotspot, show.internet.status, show.identification');
  console.log('  (expecting about 5000ms scheduler delay before flush, plus device/network time...)');

  const t2Start = Date.now();
  await firstValueFrom(forkJoin([
    rciManager.queue({path: 'show.ip.hotspot'}),
    rciManager.queue({path: 'show.internet.status'}),
    rciManager.queue({path: 'show.identification'}),
  ])).catch(() => {
  });
  const p2 = Date.now() - t2Start;
  console.log(`  Completed in ${p2}ms (expected: about 5000ms plus device/network time)\n`);

  // --- Phase 4: Swap back to fast ---
  console.log('--- Phase 4: Swapping back to TimerScheduler(0) ---');
  await firstValueFrom(rciManager.replaceBatchScheduler(new TimerScheduler(0)));
  console.log('  Scheduler swapped back.\n');

  // --- Phase 5: Fast again to confirm ---
  console.log('--- Phase 5: TimerScheduler(0) again — immediate flush ---');
  console.log('Queueing: show.interface, show.sc.user');

  const t3Start = Date.now();
  await firstValueFrom(forkJoin([
    rciManager.queue({path: 'show.interface'}),
    rciManager.queue({path: 'show.sc.user'}),
  ])).catch(() => {
  });
  const p3 = Date.now() - t3Start;
  console.log(`  Completed in ${p3}ms (expected: near-immediate flush plus device/network time)\n`);

  console.log('=== Summary ===');
  console.log(`Phase 1 (fast):  ${p1}ms`);
  console.log(`Phase 3 (slow):  ${p2}ms`);
  console.log(`Phase 5 (fast):  ${p3}ms`);
  console.log('Scheduler was swapped between batches — queue must be READY for replacement to succeed.');

  rciManager.destroy();
};

main().catch(console.error);
