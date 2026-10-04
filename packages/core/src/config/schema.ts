import { z } from 'zod'

const align = z.enum(['left', 'center', 'right'])
const sep = z.enum(['powerline', 'space', 'none'])

// Colors validated in validate.ts (so an unknown color is a warning, not a hard error).
export const itemSchema = z.object({
  id: z.string(),
  type: z.string(),
  fg: z.string().optional(),
  bg: z.string().optional(),
  merge: z.boolean().optional(),
  align: align.optional(),
  rawValue: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const surfaceLayoutSchema = z.object({
  enabled: z.boolean(),
  lines: z.array(z.array(itemSchema)),
})

export const toastRuleSchema = z.object({
  when: z.string(),
  text: z.string(),
  once: z.boolean().optional(),
})

export const configSchema = z.object({
  version: z.literal(1).catch(1),
  theme: z.string().default('default'),
  themes: z.record(z.record(z.object({ fg: z.string().optional(), bg: z.string().optional() }))).default({}),
  defaults: z.object({ separator: sep, padding: z.number(), align, glyph: z.string().min(1), invert: z.boolean() }).partial().default({}),
  surfaces: z
    .object({
      band: surfaceLayoutSchema.optional(),
      statusline: surfaceLayoutSchema.optional(),
      pane: surfaceLayoutSchema.optional(),
      toasts: z.object({ enabled: z.boolean(), rules: z.array(toastRuleSchema) }).optional(),
    })
    .default({}),
})
