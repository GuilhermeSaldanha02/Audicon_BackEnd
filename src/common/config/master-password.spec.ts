import {
  validateMasterPassword,
  WeakMasterPasswordError,
  MASTER_PASSWORD_MIN_LENGTH,
} from './master-password';

describe('validateMasterPassword', () => {
  it('accepts a strong password (≥12 chars)', () => {
    expect(() => validateMasterPassword('StrongPass1!')).not.toThrow();
  });

  it('accepts a password exactly at the minimum length', () => {
    // 12-char password with all required character classes
    expect(() => validateMasterPassword('Abcdef1!ghij')).not.toThrow();
  });

  it('throws WeakMasterPasswordError when value is empty string', () => {
    expect(() => validateMasterPassword('')).toThrow(WeakMasterPasswordError);
    expect(() => validateMasterPassword('')).toThrow(
      /required but was not set/i,
    );
  });

  it('throws WeakMasterPasswordError when value is whitespace-only', () => {
    expect(() => validateMasterPassword('   ')).toThrow(
      WeakMasterPasswordError,
    );
  });

  it('throws WeakMasterPasswordError when value is not a string', () => {
    expect(() => validateMasterPassword(null)).toThrow(WeakMasterPasswordError);
    expect(() => validateMasterPassword(undefined)).toThrow(
      WeakMasterPasswordError,
    );
    expect(() => validateMasterPassword(42)).toThrow(WeakMasterPasswordError);
  });

  it(`throws WeakMasterPasswordError when shorter than ${MASTER_PASSWORD_MIN_LENGTH} chars`, () => {
    const tooShort = 'Ab1!efg'; // 7 chars
    expect(() => validateMasterPassword(tooShort)).toThrow(
      WeakMasterPasswordError,
    );
    expect(() => validateMasterPassword(tooShort)).toThrow(/at least/i);
  });

  it('throws WeakMasterPasswordError for a password 1 char below minimum', () => {
    const oneUnder = 'A'.repeat(MASTER_PASSWORD_MIN_LENGTH - 1);
    expect(() => validateMasterPassword(oneUnder)).toThrow(
      WeakMasterPasswordError,
    );
  });

  it('error message names the minimum length', () => {
    try {
      validateMasterPassword('short');
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(WeakMasterPasswordError);
      expect((err as WeakMasterPasswordError).message).toContain(
        String(MASTER_PASSWORD_MIN_LENGTH),
      );
    }
  });
});
