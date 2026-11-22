import { validateEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  INVITE_TOKEN_SECRET: 'y'.repeat(40),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects short secrets', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects non-postgres database urls', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('refuses wildcard CORS in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: '*' })).toThrow(
      /CORS_ORIGINS/,
    );
    expect(
      validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com' })
        .CORS_ORIGINS,
    ).toBe('https://app.example.com');
  });
});

describe('optional integrations', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
    INVITE_TOKEN_SECRET: 'y'.repeat(32),
  };
  it('treats empty strings as unset', () => {
    const env = validateEnv({ ...base, RESEND_API_KEY: '', MAIL_FROM: ' ', EXPO_ACCESS_TOKEN: '' });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EXPO_ACCESS_TOKEN).toBeUndefined();
    expect(env.MAIL_FROM).toContain('Family Habit');
  });
});
