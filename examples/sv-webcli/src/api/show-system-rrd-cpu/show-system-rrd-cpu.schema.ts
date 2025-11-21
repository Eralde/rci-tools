import {z} from 'zod';

const rrdTickSchema = z.object({
  t: z.string(),
  v: z.number(),
});

export const showSystemRrdCpuResponseSchema = z.object({
  data: z.array(rrdTickSchema),
});
