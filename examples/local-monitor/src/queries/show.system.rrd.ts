export const SHOW_SYSTEM_RRD = 'show.system.rrd';

export interface RrdTick {
  t: string;
  v: number;
}

export type MetricType = 'cpu' | 'memory';

export type ShowSystemRrdApiReadResponse<M extends MetricType = MetricType> = {
  [K in M]: {
    data: RrdTick[];
  };
};
