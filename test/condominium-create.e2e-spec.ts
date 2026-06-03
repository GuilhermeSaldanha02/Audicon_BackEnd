import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { CondominiumsController } from '../src/condominiums/condominiums.controller';
import { CondominiumsService } from '../src/condominiums/condominiums.service';
import { Condominium } from '../src/condominiums/entities/condominium.entity';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { MasterGuard } from '../src/common/guards/master.guard';
import { CondominiumAccessGuard } from '../src/common/guards/condominium-access.guard';
import { UsersService } from '../src/users/users.service';
import { AuditService } from '../src/audit/audit.service';
import { SystemRole } from '../src/common/enums/system-role.enum';
import { setupApp } from '../src/setup-app';

/**
 * Fix pré-deploy: POST /condominiums passa a aceitar MASTER e GERENTE.
 * - MASTER cria para qualquer empresa (companyId do body, obrigatório).
 * - GERENTE cria apenas na própria empresa (companyId do token, body ignorado).
 * - FUNCIONARIO não pode criar (403, RolesGuard).
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';

const USERS: Record<number, any> = {
  1: {
    id: 1,
    email: 'master@x.com',
    isMaster: true,
    companyId: null,
    role: SystemRole.MASTER,
  },
  2: {
    id: 2,
    email: 'gerente@x.com',
    isMaster: false,
    companyId: 5,
    role: SystemRole.GERENTE,
  },
  3: {
    id: 3,
    email: 'func@x.com',
    isMaster: false,
    companyId: 5,
    role: SystemRole.FUNCIONARIO,
  },
};

describe('POST /condominiums (e2e) — RBAC master+gerente + resolução de companyId', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let saved: any;

  const condoRepoMock = {
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => {
      saved = { id: 1, ...v };
      return saved;
    }),
    createQueryBuilder: jest.fn(),
  };

  const usersServiceMock = {
    findOneById: jest.fn(async (id: number) => USERS[id]),
  };

  const configMock = {
    get: (key: string) =>
      key === 'JWT_SECRET'
        ? JWT_SECRET
        : key === 'CORS_ORIGINS'
          ? 'http://localhost:3001'
          : undefined,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [CondominiumsController],
      providers: [
        CondominiumsService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        MasterGuard,
        CondominiumAccessGuard,
        { provide: getRepositoryToken(Condominium), useValue: condoRepoMock },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = moduleFixture.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => {
    saved = undefined;
    condoRepoMock.save.mockClear();
  });

  const sign = (sub: number) => jwt.sign({ sub, email: USERS[sub].email });
  const body = (companyId?: number) => ({
    name: 'Condo QA',
    cnpj: '12.345.678/0001-90',
    address: 'Rua Teste, 1',
    ...(companyId !== undefined ? { companyId } : {}),
  });

  it('MASTER cria para a empresa do body → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/condominiums')
      .set('Cookie', `access_token=${sign(1)}`)
      .send(body(7))
      .expect(201);
    expect(res.body.data.companyId).toBe(7);
  });

  it('GERENTE cria na própria empresa, IGNORANDO o companyId do body → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/condominiums')
      .set('Cookie', `access_token=${sign(2)}`)
      .send(body(999)) // tenta outra empresa
      .expect(201);
    // resolve para a empresa do token (5), não a do body (999)
    expect(res.body.data.companyId).toBe(5);
  });

  it('FUNCIONARIO não pode criar → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/condominiums')
      .set('Cookie', `access_token=${sign(3)}`)
      .send(body(5))
      .expect(403);
    expect(condoRepoMock.save).not.toHaveBeenCalled();
  });

  it('Sem cookie → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/condominiums')
      .send(body(7))
      .expect(401);
  });
});
