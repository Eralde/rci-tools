import {z} from 'zod';

const fwSchema = z.object({
  exact: z.string(),
  cdate: z.string(),
});

const ndwSchema = z.object({
  version: z.string(),
})

export const showVersionResponseSchema = z.object({
  release: z.string(),
  sandbox: z.string().optional(),
  title: z.string().optional(),
  arch: z.string(),
  ndm: fwSchema,
  bsp: fwSchema,
  ndw: z.object({
    version: z.string().optional(), // exists on devices with 2.x and 3.x firmware
    features: z.string(),
    components: z.string(),
  }),
  ndw3: ndwSchema.optional(), // depends on the `easyconfig` component
  ndw4: ndwSchema.optional(), // exists on devices with 4.x
  manufacturer: z.string(),
  vendor: z.string(),
  series: z.string(),
  model: z.string(),
  hw_version: z.string(),
  hw_type: z.string().optional(),
  hw_id: z.string(),
  device: z.string(),
  class: z.string().optional(), // replaced with `hw_type` on newer devices
  region: z.string(),
  description: z.string(),
});
