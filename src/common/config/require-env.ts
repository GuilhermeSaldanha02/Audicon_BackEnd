export class MissingEnvVarError extends Error {
  constructor(public readonly variableName: string) {
    super(
      `Environment variable "${variableName}" is required but was not set or is empty. ` +
        `Check your .env file (see .env.example).`,
    );
    this.name = 'MissingEnvVarError';
  }
}

export function requireEnv(name: string): string {
  const raw = process.env[name];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) {
    throw new MissingEnvVarError(name);
  }
  return trimmed;
}

export function requireEnvInt(name: string): number {
  const value = requireEnv(name);
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(
      `Environment variable "${name}" must be an integer, got "${value}".`,
    );
  }
  return parsed;
}
