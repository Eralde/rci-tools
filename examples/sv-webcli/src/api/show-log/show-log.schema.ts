import {z} from 'zod';
import {LOG_ITEM_LEVEL} from './show-log.response';

const LOG_ITEM_LEVEL_BY_LOWERCASE = new Map(
  Object.values(LOG_ITEM_LEVEL).map((level) => [level.toLowerCase(), level]),
);

// Known levels are normalized to `LOG_ITEM_LEVEL` regardless of case; unknown levels are kept as is,
// so that a single unexpected value does not fail parsing of the whole log
export const logItemLevelSchema = z.string().transform((level): LOG_ITEM_LEVEL | string => {
  return LOG_ITEM_LEVEL_BY_LOWERCASE.get(level.toLowerCase()) ?? level;
});

export const logItemLabelSchema = z.string();

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
