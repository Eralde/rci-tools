import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {concat, defer, firstValueFrom, forkJoin} from 'rxjs';
import {FetchTransport, RciManager, RciQuery} from '../../src';
import {calculateStats, getRandomSubset, measureObsDuration, normalizeAddress, queryToUrl} from './utils.js';

const NUM_TESTS = 5;
const NUM_RUNS_PER_TESTS = 5;

const QUERIES: Array<RciQuery> = [
  {path: 'show.version'},
  {path: 'show.identification'},
  {path: 'show.interface'},
  {path: 'show.sc.interface'},
  {path: 'show.sc.user'},
  {path: 'whoami'},
  {path: 'show.system'},
  {path: 'show.interface', data: {name: 'wm0'}},
  {path: 'show.interface', data: {name: 'wm1'}},
  {path: 'show.ip.hotspot'},
  {path: 'show.interface.stat', data: {name: 'ge1/0'}},
  {path: 'show.interface.stat', data: {name: 'ge0/0'}},
  {path: 'show.interface.stat', data: {name: 'ge0/1'}},
  {path: 'show.interface.stat', data: {name: 'ge0/2'}},
  {path: 'show.internet.status'},
];

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option(
      'addr',
      {
        type: 'string',
        description: 'The IP address of the device',
        demandOption: true,
        alias: 'a',
      },
    )
    .help()
    .parseSync();

  const host = normalizeAddress(argv.addr);
  const rciBasePath = `${host}/rci/`;

  const fetchTransport = new FetchTransport();
  const rciManager = new RciManager(host, fetchTransport);

  console.log('\n--- Comparing sequential "fetch" calls, parallel "fetch" calls and "RciManager.execute" calls ---');
  console.log(`Target device: ${host}`);
  console.log(`Total queries available: ${QUERIES.length}`);
  console.log(`Running ${NUM_TESTS} sequential tests, each with ${NUM_RUNS_PER_TESTS} runs.\n`);

  for (let m = 1; m <= NUM_TESTS; m++) {
    const currentQueries = getRandomSubset(QUERIES, Math.floor(QUERIES.length / 3));

    console.log(`--- Test ${m}/${NUM_TESTS}: Running with ${currentQueries.length} queries ---`);
    console.log('  Queries:');

    currentQueries.forEach((query) => {
      console.log(`    - ${queryToUrl(rciBasePath, query)}`);
    });

    console.log('\n');

    const fetchSequentialDurations: number[] = [];
    const fetchParallelDurations: number[] = [];
    const batchedExecuteDurations: number[] = [];

    for (let n = 1; n <= NUM_RUNS_PER_TESTS; n++) {
      // Sequential "fetch" calls
      const fetchObs1$ = currentQueries.map((query) => {
        return defer(() => fetchTransport.get(queryToUrl(rciBasePath, query)));
      });

      const sequential$ = concat(...fetchObs1$);
      const durationSequential = await firstValueFrom(measureObsDuration(sequential$));
      fetchSequentialDurations.push(durationSequential);

      // Parallel "fetch" calls
      const fetchObs2$ = currentQueries.map((query) => {
        return fetchTransport.get(queryToUrl(rciBasePath, query));
      });

      const parallel$ = forkJoin(fetchObs2$);
      const durationParallel = await firstValueFrom(measureObsDuration(parallel$));
      fetchParallelDurations.push(durationParallel);

      // Batched "RciManager.queue" calls
      const queueObs$ = forkJoin(currentQueries.map((query) => rciManager.queue(query)));
      const durationQueue = await firstValueFrom(measureObsDuration(queueObs$));
      batchedExecuteDurations.push(durationQueue);
    }

    const fetchSequentialStats = calculateStats(fetchSequentialDurations);
    const fetchParallelStats = calculateStats(fetchParallelDurations);
    const executeStats = calculateStats(batchedExecuteDurations);

    console.log(`  Fetch [sequential] (${NUM_RUNS_PER_TESTS} runs)`);
    console.log(`    Avg: ${fetchSequentialStats.average.toFixed(2)} ms`);
    console.log(`    SD:  ${fetchSequentialStats.stdDev.toFixed(2)} ms`);

    console.log(`  Fetch [parallel] (${NUM_RUNS_PER_TESTS} runs)`);
    console.log(`    Avg: ${fetchParallelStats.average.toFixed(2)} ms`);
    console.log(`    SD:  ${fetchParallelStats.stdDev.toFixed(2)} ms`);

    console.log(`  RciManager.queue [batched] (${NUM_RUNS_PER_TESTS} runs)`);
    console.log(`    Avg: ${executeStats.average.toFixed(2)} ms`);
    console.log(`    SD:  ${executeStats.stdDev.toFixed(2)} ms\n`);
  }
};

main().catch(console.error);
