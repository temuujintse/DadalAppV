import { z } from 'zod';

const list = (desc: string) => ({ type: 'array', items: { type: 'string' }, description: desc });

export const INSIGHT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'positiveHighlights',
    'improvementAreas',
    'suggestions',
    'periodComparison',
  ],
  properties: {
    summary: { type: 'string', description: 'Mongolian, 1–2 sentences' },
    positiveHighlights: list('1–3 short Mongolian items'),
    improvementAreas: list('0–2 short Mongolian items, gentle'),
    suggestions: list('1–3 concrete Mongolian tips'),
    periodComparison: {
      type: 'string',
      description: 'Mongolian, one sentence comparing with the previous period',
    },
  },
} as const;

const item = z.string().trim().min(1).max(220);

export const insightSchema = z.object({
  summary: item,
  positiveHighlights: z.array(item).max(4),
  improvementAreas: z.array(item).max(3),
  suggestions: z.array(item).min(1).max(4),
  periodComparison: item,
});

export type Insight = z.infer<typeof insightSchema>;
