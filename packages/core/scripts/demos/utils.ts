import type {QueryStats, RciQuery} from '../../src';

export const QUERIES: Array<RciQuery> = [
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

export const normalizeAddress = (addr: string): string => {
  return addr.startsWith('http://') ? addr : `http://${addr}`;
};

export const getRandomSubset = <T>(arr: T[], size: number): T[] => {
  const subsetSize = Math.max(0, Math.min(arr.length - 1, size));
  const shuffled = [...arr].sort(() => 0.5 - Math.random());

  return shuffled.slice(0, subsetSize);
};

export const calculateStats = (durations: number[]) => {
  if (durations.length === 0) {
    return {average: 0, stdDev: 0};
  }

  const sum = durations.reduce((acc, val) => acc + val, 0);
  const average = sum / durations.length;
  const sumOfSquaredDifferences = durations.reduce((acc, val) => acc + Math.pow(val - average, 2), 0);
  const stdDev = Math.sqrt(sumOfSquaredDifferences / durations.length);

  return {average, stdDev};
};

export const pause = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const printStatsEntry = (stats: QueryStats): void => {
  const status = stats.success ? 'OK' : `FAIL (${String(stats.error)})`;
  console.log(
    `  ${stats.queueName} | ${stats.taskCount} tasks | ${stats.queryCount} queries | ${stats.durationMs.toFixed(2)}ms | ${status}`,
  );
};

export const printStatsSummary = (label: string, statsList: QueryStats[]): void => {
  if (statsList.length === 0) {
    console.log(`  ${label}: no batches recorded`);

    return;
  }

  const durations = statsList.map((s) => s.durationMs);
  const {average, stdDev} = calculateStats(durations);
  const succeeded = statsList.filter((s) => s.success).length;

  console.log(`  ${label}: ${statsList.length} batches, ${succeeded}/${statsList.length} OK`);
  console.log(`    Avg: ${average.toFixed(2)}ms, SD: ${stdDev.toFixed(2)}ms`);
};
