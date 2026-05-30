import { envValidationOptions, envValidationSchema } from './env.schema';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'secret',
  DB_DATABASE: 'audicon',
  JWT_SECRET: 'a-very-long-secret-string-1234',
  JWT_EXPIRATION: '3600s',
  CORS_ORIGINS: 'http://localhost:4173',
  MASTER_EMAIL: 'master@audicon.com',
  MASTER_PASSWORD: 'StrongMaster1!pass',
};

function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(env, envValidationOptions);
}

describe('envValidationSchema', () => {
  it('accepts a fully valid environment', () => {
    const { error, value } = validate(validEnv);
    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('test');
    expect(value.PORT).toBe(3000);
    expect(value.DB_PORT).toBe(5432);
  });

  it('applies defaults for NODE_ENV and PORT when omitted', () => {
    const env = { ...validEnv };
    delete (env as any).NODE_ENV;
    delete (env as any).PORT;
    const { error, value } = validate(env);
    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
  });

  it.each([
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
    'JWT_SECRET',
    'JWT_EXPIRATION',
    'CORS_ORIGINS',
    'MASTER_EMAIL',
    'MASTER_PASSWORD',
  ])('rejects when required variable %s is missing', (varName) => {
    const env = { ...validEnv };
    delete (env as any)[varName];
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain(varName);
  });

  it('reports ALL missing variables at once (abortEarly: false)', () => {
    const env: Record<string, unknown> = {};
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.details.length).toBeGreaterThanOrEqual(8);
  });

  it('rejects JWT_SECRET shorter than 16 chars', () => {
    const env = { ...validEnv, JWT_SECRET: 'short' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('rejects invalid NODE_ENV', () => {
    const env = { ...validEnv, NODE_ENV: 'staging' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('NODE_ENV');
  });

  it('rejects non-numeric PORT', () => {
    const env = { ...validEnv, PORT: 'not-a-number' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('PORT');
  });

  it('rejects PORT out of range', () => {
    const env = { ...validEnv, PORT: '99999' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('PORT');
  });

  it('rejects non-numeric DB_PORT', () => {
    const env = { ...validEnv, DB_PORT: 'abc' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('DB_PORT');
  });

  it('allows GEMINI_API_KEY to be absent', () => {
    const env = { ...validEnv };
    const { error } = validate(env);
    expect(error).toBeUndefined();
  });

  it('rejects invalid GEMINI_API_ENDPOINT (non-URI)', () => {
    const env = { ...validEnv, GEMINI_API_ENDPOINT: 'not a uri' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('GEMINI_API_ENDPOINT');
  });

  it('applies default GEMINI_TIMEOUT_MS when omitted', () => {
    const { error, value } = validate(validEnv);
    expect(error).toBeUndefined();
    expect(value.GEMINI_TIMEOUT_MS).toBe(15000);
  });

  it('rejects GEMINI_TIMEOUT_MS below minimum', () => {
    const env = { ...validEnv, GEMINI_TIMEOUT_MS: '500' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('GEMINI_TIMEOUT_MS');
  });

  it('rejects GEMINI_TIMEOUT_MS above maximum', () => {
    const env = { ...validEnv, GEMINI_TIMEOUT_MS: '120000' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('GEMINI_TIMEOUT_MS');
  });

  it('accepts valid LOG_LEVEL values', () => {
    for (const level of [
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]) {
      const env = { ...validEnv, LOG_LEVEL: level };
      const { error } = validate(env);
      expect(error).toBeUndefined();
    }
  });

  it('rejects invalid LOG_LEVEL', () => {
    const env = { ...validEnv, LOG_LEVEL: 'verbose' };
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('LOG_LEVEL');
  });

  it('treats LOG_LEVEL as optional', () => {
    const env = { ...validEnv };
    delete (env as any).LOG_LEVEL;
    const { error } = validate(env);
    expect(error).toBeUndefined();
  });

  it('allows unknown extra variables', () => {
    const env = { ...validEnv, RANDOM_THING: 'whatever' };
    const { error } = validate(env);
    expect(error).toBeUndefined();
  });

  describe('MASTER_EMAIL', () => {
    it('rejects a malformed email', () => {
      const env = { ...validEnv, MASTER_EMAIL: 'not-an-email' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MASTER_EMAIL');
    });

    it('accepts a valid email', () => {
      const env = { ...validEnv, MASTER_EMAIL: 'admin@example.com' };
      const { error } = validate(env);
      expect(error).toBeUndefined();
    });
  });

  describe('MASTER_PASSWORD', () => {
    it('accepts a password meeting all rules', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'StrongPass1!' };
      const { error } = validate(env);
      expect(error).toBeUndefined();
    });

    it('rejects a password shorter than 12 characters', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'Ab1!efg' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MASTER_PASSWORD');
    });

    it('rejects a password without an uppercase letter', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'nouppercase1!' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MASTER_PASSWORD');
    });

    it('rejects a password without a lowercase letter', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'NOLOWERCASE1!' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MASTER_PASSWORD');
    });

    it('rejects a password without a digit', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'NoDigitHere!!' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MASTER_PASSWORD');
    });

    it('rejects a password without a symbol', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'NoSymbolHere1' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MASTER_PASSWORD');
    });

    it('includes a human-readable message on pattern failure', () => {
      const env = { ...validEnv, MASTER_PASSWORD: 'nosymbolhere1' };
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/uppercase|lowercase|number|symbol/i);
    });
  });
});
