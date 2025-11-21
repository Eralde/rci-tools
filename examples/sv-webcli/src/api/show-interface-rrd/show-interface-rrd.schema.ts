import {z} from 'zod';

const rrdTickSchema = z.object({
  t: z.string(),
  v: z.number(),
});

export const showInterfaceRrdResponseSchema = z.object({
  data: z.array(rrdTickSchema),
});
