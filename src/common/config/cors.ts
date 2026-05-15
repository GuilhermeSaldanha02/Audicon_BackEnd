export function parseCorsOrigins(csv: string | undefined): string[] {
  const origins =
    typeof csv === 'string'
      ? csv
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : [];

  if (origins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must list at least one origin (comma-separated). ' +
        'Example: http://localhost:4173,https://app.audicon.com.br',
    );
  }

  return origins;
}
