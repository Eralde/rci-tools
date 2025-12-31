import {z} from 'zod';

export const showSystemResponseSchema = z.object({
  hostname: z.string(),
  domainname: z.string(),
  cpuload: z.number(),
  memory: z.string(),
  swap: z.string(),
  memtotal: z.number(),
  memfree: z.number(),
  membuffers: z.number(),
  memcache: z.number(),
  swaptotal: z.number(),
  swapfree: z.number(),
  uptime: z.string(),
  conntotal: z.number().optional(),
  connfree: z.number().optional(),
});
