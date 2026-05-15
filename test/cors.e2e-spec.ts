import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { setupApp } from './../src/setup-app';

const ALLOWED = 'http://allowed.test';
const ALSO_ALLOWED = 'https://app.audicon.com.br';
const DENIED = 'http://evil.test';

describe('CORS (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CORS_ORIGINS') return `${ALLOWED},${ALSO_ALLOWED}`;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows preflight from an allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows preflight from a second allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1')
      .set('Origin', ALSO_ALLOWED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe(ALSO_ALLOWED);
  });

  it('does not reflect Access-Control-Allow-Origin for a denied origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1')
      .set('Origin', DENIED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
