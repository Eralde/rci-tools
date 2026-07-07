import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {firstValueFrom, forkJoin} from 'rxjs';
import {FetchTransport, RciManager, type QueryStats} from '../../src';
import {
  calculateStats,
  normalizeAddress,
  getRandomSubset,
  printStatsSummary,
  QUERIES,
  pause,
} from './utils.js';

const NUM_ITERATIONS = 5;
const QUERIES_PER_ITERATION = Math.floor(QUERIES.length / 3);

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

  console.log('\n=== Stats Collection Demo ===');
  console.log(`Target device: ${host}`);
  console.log(`Total queries available: ${QUERIES.length}`);
  console.log(`Running ${NUM_ITERATIONS} iterations, each with ~${QUERIES_PER_ITERATION} queries\n`);

  rciManager.toggleStats(true);

  const allIterationStats: Array<Array<QueryStats>> = [];

  for (let i = 0; i < NUM_ITERATIONS; i++) {
    const subset = getRandomSubset(QUERIES, QUERIES_PER_ITERATION);

    const iterationStats: Array<QueryStats> = [];
    const statsSub = rciManager.stats$.subscribe((s) => {
      iterationStats.push(s);
    });

    console.log(`--- Iteration ${i + 1}/${NUM_ITERATIONS}: ${subset.length} queries ---`);
    subset.forEach((q) => {
      const suffix = q.data ? ` ${JSON.stringify(q.data)}` : '';
      console.log(`  ${q.path}${suffix}`);
    });

    const t0 = Date.now();
    await firstValueFrom(forkJoin(subset.map((q) => rciManager.queue(q)))).catch(() => {
    });
    const totalElapsed = Date.now() - t0;

    await pause(30);
    statsSub.unsubscribe();

    allIterationStats.push(iterationStats);

    console.log(`  Wall-clock: ${totalElapsed}ms`);
    printStatsSummary('  Stats batches', iterationStats);
    console.log('');
  }

  rciManager.toggleStats(false);

  // --- Aggregated summary across all iterations ---
  console.log('=== Aggregated Summary ===');
  const allStats = allIterationStats.flat();
  const allDurations = allStats.map((s) => s.durationMs);
  const {average, stdDev} = calculateStats(allDurations);

  const totalBatches = allStats.length;
  const succeeded = allStats.filter((s) => s.success).length;

  console.log(`Total iterations: ${NUM_ITERATIONS}`);
  console.log(`Total batches: ${totalBatches}`);
  console.log(`Success rate: ${succeeded}/${totalBatches}`);
  console.log(`Batch avg duration: ${average.toFixed(2)}ms, SD: ${stdDev.toFixed(2)}ms`);

  rciManager.destroy();
};

main().catch(console.error);
