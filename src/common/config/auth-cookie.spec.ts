import { ConfigService } from '@nestjs/config';
import {
  AUTH_COOKIE_NAME,
  buildAuthCookieOptions,
  buildAuthCookieClearOptions,
  parseDurationToMs,
} from './auth-cookie';

function configWith(values: Record<string, unknown>): ConfigService {
  return {
    get: <T>(key: string): T => values[key] as T,
  } as unknown as ConfigService;
}

describe('auth-cookie', () => {
  describe('AUTH_COOKIE_NAME', () => {
    it('é a constante fixa access_token', () => {
      expect(AUTH_COOKIE_NAME).toBe('access_token');
    });
  });

  describe('parseDurationToMs', () => {
    it('número puro = segundos', () => {
      expect(parseDurationToMs('3600')).toBe(3_600_000);
    });
    it('sufixos s/m/h/d', () => {
      expect(parseDurationToMs('30s')).toBe(30_000);
      expect(parseDurationToMs('15m')).toBe(900_000);
      expect(parseDurationToMs('1h')).toBe(3_600_000);
      expect(parseDurationToMs('7d')).toBe(604_800_000);
    });
    it('formato inválido ou vazio → null', () => {
      expect(parseDurationToMs(undefined)).toBeNull();
      expect(parseDurationToMs('abc')).toBeNull();
      expect(parseDurationToMs('1w')).toBeNull();
    });
  });

  describe('buildAuthCookieOptions', () => {
    it('dev: lax + secure=false, httpOnly sempre, maxAge de JWT_EXPIRATION', () => {
      const opts = buildAuthCookieOptions(
        configWith({
          COOKIE_SAMESITE: 'lax',
          COOKIE_SECURE: 'false',
          JWT_EXPIRATION: '1h',
        }),
      );
      expect(opts).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 3_600_000,
        path: '/',
      });
    });

    it('prod: none + secure=true (aceita boolean true coerced)', () => {
      const opts = buildAuthCookieOptions(
        configWith({
          COOKIE_SAMESITE: 'none',
          COOKIE_SECURE: true,
          JWT_EXPIRATION: '1h',
        }),
      );
      expect(opts.sameSite).toBe('none');
      expect(opts.secure).toBe(true);
      expect(opts.httpOnly).toBe(true);
    });

    it('defaults para lax/secure=false quando env ausente', () => {
      const opts = buildAuthCookieOptions(configWith({ JWT_EXPIRATION: '1h' }));
      expect(opts.sameSite).toBe('lax');
      expect(opts.secure).toBe(false);
    });

    it('COOKIE_MAX_AGE_MS tem precedência sobre JWT_EXPIRATION', () => {
      const opts = buildAuthCookieOptions(
        configWith({ COOKIE_MAX_AGE_MS: '120000', JWT_EXPIRATION: '1h' }),
      );
      expect(opts.maxAge).toBe(120_000);
    });

    it('fallback 1h quando nada parseável', () => {
      const opts = buildAuthCookieOptions(configWith({}));
      expect(opts.maxAge).toBe(3_600_000);
    });

    it('SameSite=None sem Secure → lança (browsers descartam)', () => {
      expect(() =>
        buildAuthCookieOptions(
          configWith({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' }),
        ),
      ).toThrow(/SameSite=none/i);
    });
  });

  describe('buildAuthCookieClearOptions', () => {
    it('retorna a base SEM maxAge (delete real no clearCookie)', () => {
      const opts = buildAuthCookieClearOptions(
        configWith({
          COOKIE_SAMESITE: 'lax',
          COOKIE_SECURE: 'false',
          JWT_EXPIRATION: '1h',
        }),
      );
      expect(opts).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      expect(opts).not.toHaveProperty('maxAge');
    });

    it('aplica a mesma regra none⇒secure', () => {
      expect(() =>
        buildAuthCookieClearOptions(
          configWith({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' }),
        ),
      ).toThrow(/SameSite=none/i);
    });
  });
});
