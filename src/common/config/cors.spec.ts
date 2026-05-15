import { parseCorsOrigins } from './cors';

describe('parseCorsOrigins', () => {
  it('parses a single origin', () => {
    expect(parseCorsOrigins('http://localhost:4173')).toEqual([
      'http://localhost:4173',
    ]);
  });

  it('parses multiple origins separated by commas', () => {
    expect(
      parseCorsOrigins('http://localhost:4173,https://app.audicon.com.br'),
    ).toEqual(['http://localhost:4173', 'https://app.audicon.com.br']);
  });

  it('trims whitespace around each origin', () => {
    expect(parseCorsOrigins('  http://a.test  ,   http://b.test   ')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('ignores empty segments from extra commas', () => {
    expect(parseCorsOrigins('http://a.test,,http://b.test,')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('throws when input is undefined', () => {
    expect(() => parseCorsOrigins(undefined)).toThrow(/CORS_ORIGINS/);
  });

  it('throws when input is empty string', () => {
    expect(() => parseCorsOrigins('')).toThrow(/CORS_ORIGINS/);
  });

  it('throws when input is only commas / whitespace', () => {
    expect(() => parseCorsOrigins(' , , , ')).toThrow(/CORS_ORIGINS/);
  });
});
