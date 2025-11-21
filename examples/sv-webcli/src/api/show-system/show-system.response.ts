export const SHOW_SYSTEM = 'show.system';

export interface ShowSystemResponse {
  hostname: string;
  domainname: string;
  cpuload: number;
  memory: string; // <used>/<total>
  swap: string; // <used>/<total>
  memtotal: number;
  memfree: number;
  membuffers: number;
  memcache: number;
  swaptotal: number;
  swapfree: number;
  uptime: string; // in seconds
  conntotal: number;
  connfree: number;
}
