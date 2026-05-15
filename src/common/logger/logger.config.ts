import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.senha',
  'req.body.access_token',
  'req.body.token',
  '*.password',
  '*.senha',
  '*.token',
  '*.access_token',
];

function defaultLevelFor(env: string): string {
  if (env === 'production') return 'info';
  if (env === 'test') return 'silent';
  return 'debug';
}

export function buildLoggerConfig(configService: ConfigService): Params {
  const env = configService.get<string>('NODE_ENV') ?? 'development';
  const level = configService.get<string>('LOG_LEVEL') ?? defaultLevelFor(env);

  const usePretty = env === 'development';

  return {
    pinoHttp: {
      level,
      transport: usePretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              singleLine: false,
            },
          }
        : undefined,
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },
      serializers: {
        req(req: any) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
          };
        },
      },
      autoLogging: env !== 'test',
    },
  };
}
