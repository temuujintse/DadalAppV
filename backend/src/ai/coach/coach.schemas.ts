import { z } from 'zod';
import { HABIT_ICON_KEYS } from '../../common/constants';

/**
 * Structured output contracts for the Habit Coach. The JSON Schemas go to the model
 * (strict mode); the zod schemas re-validate the answer with the business limits.
 */

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'CUSTOM'] as const;

const recommendationJson = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'description',
    'icon',
    'difficulty',
    'frequency',
    'scheduleDays',
    'estimatedMinutes',
    'reason',
    'expectedBenefit',
  ],
  properties: {
    title: { type: 'string', description: 'Short habit name in Mongolian, max 60 chars' },
    description: { type: 'string', description: 'One sentence in Mongolian, max 200 chars' },
    icon: { type: 'string', enum: [...HABIT_ICON_KEYS] },
    difficulty: { type: 'string', enum: [...DIFFICULTIES] },
    frequency: { type: 'string', enum: [...FREQUENCIES] },
    scheduleDays: {
      type: 'array',
      description: 'Weekdays 0=Sunday … 6=Saturday',
      items: { type: 'integer' },
    },
    estimatedMinutes: { type: 'integer' },
    reason: { type: 'string', description: 'Why it fits this user, Mongolian, max 200 chars' },
    expectedBenefit: { type: 'string', description: 'Mongolian, max 160 chars' },
  },
} as const;

export const RECOMMENDATIONS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations'],
  properties: {
    recommendations: { type: 'array', items: recommendationJson },
  },
} as const;

const text = (max: number) => z.string().trim().min(1).max(max);

export const recommendationSchema = z.object({
  title: text(60),
  description: text(200),
  icon: z.enum(HABIT_ICON_KEYS),
  difficulty: z.enum(DIFFICULTIES),
  frequency: z.enum(FREQUENCIES),
  scheduleDays: z
    .array(z.number().int().min(0).max(6))
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  estimatedMinutes: z.number().int().min(1).max(180),
  reason: text(200),
  expectedBenefit: text(160),
});

export type RecommendationPayload = z.infer<typeof recommendationSchema>;

export const recommendationsSchema = z.object({
  recommendations: z.array(z.unknown()).max(10),
});

export const CHAT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply'],
  properties: {
    reply: { type: 'string', description: 'Answer in Mongolian, friendly, max ~120 words' },
  },
} as const;

export const chatSchema = z.object({ reply: text(1200) });

/** Business rule: the schedule must agree with the frequency. */
export function normalizeSchedule(p: RecommendationPayload): RecommendationPayload | null {
  if (p.frequency === 'DAILY') return { ...p, scheduleDays: [0, 1, 2, 3, 4, 5, 6] };
  if (p.scheduleDays.length === 0) return null;
  if (p.frequency === 'WEEKLY' && p.scheduleDays.length > 4) return null;
  return p;
}
