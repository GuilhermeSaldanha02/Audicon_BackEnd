import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { LocalStrategy } from '../src/auth/strategies/local.strategy';
import { UsersService } from '../src/users/users.service';
import { setupApp } from '../src/setup-app';
import { SystemRole } from '../src/common/enums/system-role.enum';

/**
 * R-08 — Prova ponta a ponta do fluxo de autenticação por cookie httpOnly:
 * login seta o cookie (sem token no corpo), o cookie autentica /auth/profile,
 * sem cookie dá 401, e o logout remove o cookie.
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';
const PASSWORD = 'S3nh@Segura';

describe('Auth por cookie httpOnly (e2e) — R-08', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const user = {
    id: 1,
    email: 'maria@email.com',
    nome: 'Maria',
    isMaster: false,
    companyId: 7,
    mustChangePassword: false,
    senha: bcrypt.hashSync(PASSWORD, 10),
    deletedAt: null,
  };

  // R-16 — usuário desativado (soft-delete). Mantém a senha correta de propósito:
  // a revogação NÃO pode depender da senha, e sim de `deletedAt`.
  const deactivated = {
    id: 2,
    email: 'desativado@email.com',
    nome: 'Ex-Func',
    isMaster: false,
    companyId: 7,
    mustChangePassword: false,
    senha: bcrypt.hashSync(PASSWORD, 10),
    deletedAt: new Date(),
  };

  const byEmail: Record<string, any> = {
    [user.email]: user,
    [deactivated.email]: deactivated,
  };
  const byId: Record<number, any> = {
    [user.id]: user,
    [deactivated.id]: deactivated,
  };

  const usersServiceMock = {
    findOneByEmail: jest.fn(async (email: string) => byEmail[email] ?? null),
    findOneById: jest.fn(async (id: number) => byId[id] ?? null),
    getProfile: jest.fn(async () => ({
      nome: user.nome,
      email: user.email,
      isMaster: user.isMaster,
      companyId: user.companyId,
      mustChangePassword: user.mustChangePassword,
      companyName: 'Empresa X',
      role: SystemRole.FUNCIONARIO,
    })),
  };

  const configMock = {
    get: (key: string) => {
      const values: Record<string, unknown> = {
        JWT_SECRET,
        CORS_ORIGINS: 'http://localhost:3001',
        COOKIE_SAMESITE: 'lax',
        COOKIE_SECURE: 'false',
        JWT_EXPIRATION: '1h',
      };
      return values[key];
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        LocalStrategy,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function extractAuthCookie(setCookie: string[] | undefined): string {
    const header = (setCookie ?? []).find((c) => c.startsWith('access_token='));
    expect(header).toBeDefined();
    return (header as string).split(';')[0]; // "access_token=<jwt>"
  }

  it('login seta cookie httpOnly e corpo é { success: true } (sem token no corpo)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    expect(res.body.data).toEqual({ success: true });
    expect(JSON.stringify(res.body)).not.toContain('access_token');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const authCookie = (setCookie ?? []).find((c) =>
      c.startsWith('access_token='),
    );
    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);
  });

  it('cookie do login autentica GET /auth/profile (200) com claims estendidos', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const cookie = extractAuthCookie(
      login.headers['set-cookie'] as unknown as string[],
    );

    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Cookie', cookie)
      .expect(200);

    expect(profile.body.data).toMatchObject({
      isMaster: false,
      companyId: 7,
      mustChangePassword: false,
      role: SystemRole.FUNCIONARIO,
    });
  });

  it('sem cookie → GET /auth/profile dá 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/profile').expect(401);
  });

  it('credenciais inválidas → 401 e não seta cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'errada' })
      .expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  // ===== R-16 — revogação real de acesso de usuário desativado (PARADA 1) =====

  it('PARADA 1 (b): login de usuário DESATIVADO → 401 (mesmo com a senha correta)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: deactivated.email, password: PASSWORD })
      .expect(401);
    // não vaza cookie para o desativado
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('PARADA 1 (a): request autenticado com JWT válido de usuário DESATIVADO → 401 (revogado no próximo request)', async () => {
    // Forja um cookie como se tivesse sido emitido ANTES da desativação (JWT
    // ainda dentro da validade). A revogação real acontece na JwtStrategy, que
    // recarrega o user e recusa por deletedAt — não espera o token expirar.
    const cookie = `access_token=${jwt.sign({
      sub: deactivated.id,
      email: deactivated.email,
    })}`;
    await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('logout limpa o cookie (200, Set-Cookie expira access_token)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const cookie = extractAuthCookie(
      login.headers['set-cookie'] as unknown as string[],
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.data).toEqual({ success: true });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cleared = (setCookie ?? []).find((c) =>
      c.startsWith('access_token='),
    );
    expect(cleared).toBeDefined();
    // Delete real: valor vazio E expirado no passado (não um cookie vazio que
    // persiste por maxAge). clearCookie sem maxAge emite Expires epoch.
    expect(cleared).toMatch(/access_token=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(cleared).not.toMatch(/Max-Age=\d/i);
  });
});
