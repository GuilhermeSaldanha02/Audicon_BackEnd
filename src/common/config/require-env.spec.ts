import { MissingEnvVarError, requireEnv, requireEnvInt } from './require-env';

describe('requireEnv', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the trimmed value when the variable is set', () => {
    process.env.SOME_VAR = '  value  ';
    expect(requireEnv('SOME_VAR')).toBe('value');
  });

  it('throws MissingEnvVarError naming the variable when undefined', () => {
    delete process.env.MISSING_VAR;
    expect(() => requireEnv('MISSING_VAR')).toThrow(MissingEnvVarError);
    expect(() => requireEnv('MISSING_VAR')).toThrow(/MISSING_VAR/);
  });

  it('treats empty string as missing', () => {
    process.env.EMPTY_VAR = '';
    expect(() => requireEnv('EMPTY_VAR')).toThrow(MissingEnvVarError);
  });

  it('treats whitespace-only as missing', () => {
    process.env.SPACES_VAR = '   ';
    expect(() => requireEnv('SPACES_VAR')).toThrow(MissingEnvVarError);
  });
});

describe('requireEnvInt', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('parses a valid integer', () => {
    process.env.INT_VAR = '5432';
    expect(requireEnvInt('INT_VAR')).toBe(5432);
  });

  it('throws MissingEnvVarError when variable is missing', () => {
    delete process.env.INT_VAR;
    expect(() => requireEnvInt('INT_VAR')).toThrow(MissingEnvVarError);
  });

  it('throws when the value is not an integer', () => {
    process.env.INT_VAR = 'not-a-number';
    expect(() => requireEnvInt('INT_VAR')).toThrow(/must be an integer/);
  });

  it('throws when the value is a float', () => {
    process.env.INT_VAR = '5432.5';
    expect(() => requireEnvInt('INT_VAR')).toThrow(/must be an integer/);
  });
});
