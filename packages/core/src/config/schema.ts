import { z } from 'zod';

const align = z.enum(['left', 'center', 'right']);
const sep = z.enum(['powerline', 'space', 'none']);

// Kept intentionally loose (type: z.string(), not z.enum) so an unknown widget
// type is a dropped item with a warning, not a hard parse failure that loses the
// whole config. validate.ts (cleanItem) is the smart constructor that turns a
// parsed row into the discriminated `Item` union. Colors are validated there too.
// `metadata` is still accepted so legacy configs (text/command under metadata)
// can be migrated forward.
const itemSchema = z.object({
  id: z.string(),
  type: z.string(),
  fg: z.string().optional(),
  bg: z.string().optional(),
  merge: z.boolean().optional(),
  align: align.optional(),
  rawValue: z.boolean().optional(),
  text: z.string().optional(),
  command: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const surfaceLayoutSchema = z.object({
  enabled: z.boolean(),
  lines: z.array(z.array(itemSchema)),
});

const toastRuleSchema = z.object({
  when: z.string(),
  text: z.string(),
  once: z.boolean().optional(),
});

export const configSchema = z.object({
  version: z.literal(1).catch(1),
  theme: z.string().default('default'),
  themes: z
    .record(z.record(z.object({ fg: z.string().optional(), bg: z.string().optional() })))
    .default({}),
  defaults: z
    .object({
      separator: sep,
      padding: z.number().int().min(0).catch(1),
      align,
      glyph: z.string().min(1),
      invert: z.boolean(),
    })
    .partial()
    .default({}),
  surfaces: z
    .object({
      band: surfaceLayoutSchema.optional(),
      statusline: surfaceLayoutSchema.optional(),
      pane: surfaceLayoutSchema.optional(),
      toasts: z.object({ enabled: z.boolean(), rules: z.array(toastRuleSchema) }).optional(),
    })
    .default({}),
});
