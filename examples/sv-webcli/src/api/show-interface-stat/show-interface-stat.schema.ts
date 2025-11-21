import {z} from 'zod';

export const showInterfaceStatResponseSchema = z.object({
  rxpackets: z.number(),
  'rx-multicast-packets': z.number(),
  'rx-broadcast-packets': z.number(),
  rxbytes: z.number(),
  rxerrors: z.number(),
  rxdropped: z.number(),
  txpackets: z.number(),
  'tx-multicast-packets': z.number(),
  'tx-broadcast-packets': z.number(),
  txbytes: z.number(),
  txerrors: z.number(),
  txdropped: z.number(),
  timestamp: z.string(),
  'last-overflow': z.string(),
  rxspeed: z.number(),
  txspeed: z.number(),
});
