import {z} from 'zod';
import {LOG_ITEM_LEVEL} from './show-log.response';

export const logItemLevelSchema = z.enum(LOG_ITEM_LEVEL);

export const logItemLabelSchema = z.union([
  z.literal('I'),
  z.literal('W'),
  z.literal('E'),
  z.literal('C'),
  z.literal('\u2014'),
]);

export const logItemSchema = z.object({
  message: z.object({
    level: logItemLevelSchema,
    label: logItemLabelSchema,
    message: z.string(),
  }),
  timestamp: z.string(),
  ident: z.string(),
  id: z.number(),
});

export const showLogResponseSchema = z.object({
  log: z.record(z.string(), logItemSchema).optional(),
  continued: z.boolean().optional(),
});
