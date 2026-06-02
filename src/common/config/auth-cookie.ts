import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

/**
 * Nome (fixo) do cookie httpOnly que carrega o JWT de acesso (R-08).
 * Constante de propósito — não vem de env.
 */
export const AUTH_COOKIE_NAME = 'access_token';

const DEFAULT_MAX_AGE_MS = 3_600_000; // 1h — fallback quando nada é parseável.

/**
 * Converte uma duração no formato do `@nestjs/jwt` (`expiresIn`) para ms.
 * Aceita número puro (segundos, convenção JWT) ou `<n><s|m|h|d>`.
 * Retorna `null` quando não consegue parsear.
 */
export function parseDurationToMs(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 1000;
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mult =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60_000
        : unit === 'h'
          ? 3_600_000
          : 86_400_000;
  return n * mult;
}

function resolveMaxAgeMs(config: ConfigService): number {
  const explicit = config.get<string | number>('COOKIE_MAX_AGE_MS');
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    const n = Number(explicit);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return (
    parseDurationToMs(config.get<string>('JWT_EXPIRATION')) ??
    DEFAULT_MAX_AGE_MS
  );
}

/**
 * Monta as opções do cookie de autenticação por ambiente, lidas via ConfigService.
 *
 * - `httpOnly`: sempre `true` (fecha XSS — token fora do alcance do JS).
 * - `sameSite`: `COOKIE_SAMESITE` (`lax` em dev same-site / `none` em prod cross-site).
 * - `secure`: `COOKIE_SECURE` (`false` em dev sem HTTPS / `true` em prod).
 * - `maxAge`: derivado de `JWT_EXPIRATION` (ou `COOKIE_MAX_AGE_MS` se setado).
 *
 * Falha cedo se `SameSite=None` sem `Secure` — combinação que os browsers descartam.
 */
export function buildAuthCookieOptions(config: ConfigService): CookieOptions {
  const sameSiteRaw = (
    config.get<string>('COOKIE_SAMESITE') ?? 'lax'
  ).toLowerCase();
  const sameSite = (
    ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax'
  ) as 'lax' | 'strict' | 'none';

  const secureRaw = config.get<string | boolean>('COOKIE_SECURE');
  const secure = secureRaw === true || secureRaw === 'true';

  if (sameSite === 'none' && !secure) {
    throw new Error(
      'COOKIE_SAMESITE=none exige COOKIE_SECURE=true — browsers descartam ' +
        'cookies SameSite=None sem Secure. Ajuste o .env do ambiente.',
    );
  }

  return {
    httpOnly: true,
    sameSite,
    secure,
    maxAge: resolveMaxAgeMs(config),
    path: '/',
  };
}
