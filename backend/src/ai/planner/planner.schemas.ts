import { z } from 'zod';

/** Strict JSON Schema for the model; refs are limited to today's candidates. */
export function planJsonSchema(refs: string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['items', 'summary'],
    properties: {
      summary: {
        type: 'string',
        description: 'One encouraging sentence in Mongolian, max 160 chars',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['ref', 'startTime', 'durationMinutes', 'note'],
          properties: {
            ref: { type: 'string', enum: refs },
            startTime: { type: 'string', description: '24h local time "HH:mm"' },
            durationMinutes: { type: 'integer' },
            note: { type: 'string', description: 'Short tip in Mongolian, max 100 chars, or ""' },
          },
        },
      },
    },
  };
}

export const planOutputSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  items: z
    .array(
      z.object({
        ref: z.string(),
        startTime: z.string(),
        durationMinutes: z.number().int(),
        note: z.string().max(200),
      }),
    )
    .max(30),
});

export type PlanOutput = z.infer<typeof planOutputSchema>;
