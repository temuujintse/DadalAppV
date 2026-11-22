import { z } from 'zod';

/**
 * Environment contract. The app refuses to boot when a variable is missing or invalid,
 * so misconfiguration surfaces at deploy time instead of at the first request.
 */
/** Hosting dashboards often set unused variables to "" — treat that as not set. */
const emptyAsUndefined = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default('*'),
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),

  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgresql:// connection string'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  INVITE_TOKEN_SECRET: z.string().min(32, 'INVITE_TOKEN_SECRET must be at least 32 characters'),
  INVITE_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(72),

  /** How many past local days an offline completion may still be synced for (spec §15). */
  OFFLINE_SYNC_WINDOW_DAYS: z.coerce.number().int().min(0).max(14).default(3),

  /** Password reset codes (e-mailed) stay valid this long. */
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
  /** Resend API key for transactional e-mail; unset = codes are only logged (non-production). */
  RESEND_API_KEY: emptyAsUndefined,
  MAIL_FROM: emptyAsUndefined.transform((v) => v ?? 'Family Habit <onboarding@resend.dev>'),
  /** Optional Expo access token when "enhanced push security" is enabled for the project. */
  EXPO_ACCESS_TOKEN: emptyAsUndefined,

  RATE_LIMIT_DEFAULT: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.trim() === '*') {
    throw new Error('CORS_ORIGINS must list explicit origins in production');
  }
  return env;
}
