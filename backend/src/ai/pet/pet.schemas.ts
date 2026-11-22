import { z } from 'zod';
import { AI_ANIMATIONS, PET_ACTIONS, PET_EMOTIONS } from './pet-rules';

export const PET_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'emotion', 'animation', 'suggestedAction'],
  properties: {
    message: { type: 'string', description: 'Mongolian, child-friendly, max 120 chars' },
    emotion: { type: 'string', enum: [...PET_EMOTIONS] },
    animation: { type: 'string', enum: [...AI_ANIMATIONS] },
    suggestedAction: { type: 'string', enum: [...PET_ACTIONS] },
  },
} as const;

export const petOutputSchema = z.object({
  message: z.string().trim().min(1).max(160),
  emotion: z.enum(PET_EMOTIONS),
  animation: z.enum(AI_ANIMATIONS),
  suggestedAction: z.enum(PET_ACTIONS),
});
