/**
 * Master password rules shared between the seed migration and (conceptually)
 * the Joi env schema.
 *
 * Two validation layers exist by design (see SDD R-06):
 * - This helper is the *floor* the seed migration enforces (non-empty, min
 *   length). The migration runs OUTSIDE the Nest ConfigModule/Joi pipeline, so
 *   it must fail fast on its own instead of seeding a junk password.
 * - The full strong-password rule (uppercase + lowercase + digit + symbol)
 *   lives in the Joi schema and runs at app boot.
 */

export const MASTER_PASSWORD_MIN_LENGTH = 12;

export class WeakMasterPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeakMasterPasswordError';
  }
}

/**
 * Floor validation used by the seed migration. Throws a clear
 * WeakMasterPasswordError if the password is empty or too short.
 */
export function validateMasterPassword(password: unknown): void {
  if (typeof password !== 'string' || password.trim().length === 0) {
    throw new WeakMasterPasswordError(
      'MASTER_PASSWORD is required but was not set or is empty.',
    );
  }
  if (password.length < MASTER_PASSWORD_MIN_LENGTH) {
    throw new WeakMasterPasswordError(
      `MASTER_PASSWORD must be at least ${MASTER_PASSWORD_MIN_LENGTH} characters long.`,
    );
  }
}
