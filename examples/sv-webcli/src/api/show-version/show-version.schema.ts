import {z} from 'zod';

export const showVersionResponseSchema = z.object({
  release: z.string(),
  sandbox: z.string(),
  title: z.string(),
  arch: z.string(),
  ndm: z.object({
    exact: z.string(),
    cdate: z.string(),
  }),
  bsp: z.object({
    exact: z.string(),
    cdate: z.string(),
  }),
  ndw: z.object({
    features: z.string(),
    components: z.string(),
  }),
  ndw3: z.object({
    version: z.string(),
  }),
  ndw4: z.object({
    version: z.string(),
  }),
  manufacturer: z.string(),
  vendor: z.string(),
  series: z.string(),
  model: z.string(),
  hw_version: z.string(),
  hw_type: z.string(),
  hw_id: z.string(),
  device: z.string(),
  region: z.string(),
  description: z.string(),
});
