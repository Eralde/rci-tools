import {z} from 'zod';

export const probeResponseSchema = z.object({
  prefix_no: z.boolean().optional(),
  multiple: z.boolean().optional(),
  nameable: z.boolean().optional(),
  read_only: z.boolean().optional(),
  has_prompt: z.boolean().optional(),
  found: z.boolean(),
});
