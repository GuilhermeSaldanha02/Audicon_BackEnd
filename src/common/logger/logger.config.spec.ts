import { ConfigService } from '@nestjs/config';
import { buildLoggerConfig } from './logger.config';

function fakeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('buildLoggerConfig', () => {
  it('returns info level + JSON transport in production', () => {
    const cfg = buildLoggerConfig(fakeConfig({ NODE_ENV: 'production' }));
    expect(cfg.pinoHttp).toBeDefined();
    const opts: any = cfg.pinoHttp;
    expect(opts.level).toBe('info');
    expect(opts.transport).toBeUndefined();
  });

  it('returns debug level + pino-pretty transport in development', () => {
    const cfg = buildLoggerConfig(fakeConfig({ NODE_ENV: 'development' }));
    const opts: any = cfg.pinoHttp;
    expect(opts.level).toBe('debug');
    expect(opts.transport.target).toBe('pino-pretty');
    expect(opts.transport.options.colorize).toBe(true);
  });

  it('returns silent level + no autoLogging in test', () => {
    const cfg = buildLoggerConfig(fakeConfig({ NODE_ENV: 'test' }));
    const opts: any = cfg.pinoHttp;
    expect(opts.level).toBe('silent');
    expect(opts.autoLogging).toBe(false);
  });

  it('honors LOG_LEVEL override regardless of env', () => {
    const cfg = buildLoggerConfig(
      fakeConfig({ NODE_ENV: 'production', LOG_LEVEL: 'trace' }),
    );
    const opts: any = cfg.pinoHttp;
    expect(opts.level).toBe('trace');
  });

  it('redacts sensitive paths with [REDACTED] censor', () => {
    const cfg = buildLoggerConfig(fakeConfig({ NODE_ENV: 'production' }));
    const opts: any = cfg.pinoHttp;
    expect(opts.redact.censor).toBe('[REDACTED]');
    expect(opts.redact.paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.body.password',
        'req.body.senha',
        '*.token',
        '*.access_token',
      ]),
    );
  });

  it('req serializer strips body and keeps method/url/query/params/id', () => {
    const cfg = buildLoggerConfig(fakeConfig({ NODE_ENV: 'production' }));
    const opts: any = cfg.pinoHttp;
    const serialized = opts.serializers.req({
      id: 'req-123',
      method: 'POST',
      url: '/x',
      query: { a: 1 },
      params: { id: 7 },
      body: { senha: 'segredo' },
      headers: { authorization: 'Bearer xxx' },
    });
    expect(serialized).toEqual({
      id: 'req-123',
      method: 'POST',
      url: '/x',
      query: { a: 1 },
      params: { id: 7 },
    });
    expect((serialized as any).body).toBeUndefined();
    expect((serialized as any).headers).toBeUndefined();
  });
});
