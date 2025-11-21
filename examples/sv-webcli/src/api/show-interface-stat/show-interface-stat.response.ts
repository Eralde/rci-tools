export interface ShowInterfaceStatResponse {
  rxpackets: number;
  'rx-multicast-packets': number;
  'rx-broadcast-packets': number;
  rxbytes: number;
  rxerrors: number;
  rxdropped: number;
  txpackets: number;
  'tx-multicast-packets': number;
  'tx-broadcast-packets': number;
  txbytes: number;
  txerrors: number;
  txdropped: number;
  timestamp: string;
  'last-overflow': string;
  rxspeed: number;
  txspeed: number;
}
