import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { CompaniesController } from '../src/companies/companies.controller';
import { CompaniesService } from '../src/companies/companies.service';
import { CondominiumsService } from '../src/condominiums/condominiums.service';
import { Company } from '../src/companies/entities/company.entity';
import { User } from '../src/users/entities/user.entity';
import { Condominium } from '../src/condominiums/entities/condominium.entity';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { MasterGuard } from '../src/common/guards/master.guard';
import { CompanyAccessGuard } from '../src/common/guards/company-access.guard';
import { UsersService } from '../src/users/users.service';
import { AuditService } from '../src/audit/audit.service';
import { SystemRole } from '../src/common/enums/system-role.enum';
import { setupApp } from '../src/setup-app';

/**
 * R-15 — GERENTE cria/lista funcionários da PRÓPRIA empresa.
 * Cobre o RBAC das duas rotas abertas (POST/GET /companies/:companyId/users):
 * RolesGuard (papel) + CompanyAccessGuard (tenant), role forçado FUNCIONARIO,
 * e a listagem incluindo role.
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';
const OWN = 5; // empresa do gerente/funcionário
const OTHER = 6; // outra empresa

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
    companyId: OWN,
    role: SystemRole.GERENTE,
  },
  3: {
    id: 3,
    email: 'func@x.com',
    isMaster: false,
    companyId: OWN,
    role: SystemRole.FUNCIONARIO,
  },
};

describe('Company employees (e2e) — R-15 GERENTE cria/lista funcionários', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const companyRepo = {
    // CompaniesService.findOne usa findOneBy
    findOneBy: jest.fn(async () => ({ id: OWN, name: 'Empresa X' })),
  };
  const userRepo = {
    findOne: jest.fn(async () => null), // sem e-mail duplicado
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => ({ id: 99, ...v })),
    find: jest.fn(async () => [
      {
        id: 10,
        nome: 'Func A',
        email: 'a@x.com',
        role: SystemRole.FUNCIONARIO,
      },
    ]),
  };
  const usersServiceMock = {
    findOneById: jest.fn(async (id: number) => USERS[id]),
  };
  const configMock = {
    get: (k: string) =>
      k === 'JWT_SECRET'
        ? JWT_SECRET
        : k === 'CORS_ORIGINS'
          ? 'http://localhost:3001'
          : undefined,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [CompaniesController],
      providers: [
        CompaniesService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        MasterGuard,
        CompanyAccessGuard,
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Condominium), useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: CondominiumsService,
          useValue: { findByCompany: jest.fn() },
        },
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
  beforeEach(() => userRepo.create.mockClear());

  const cookie = (sub: number) =>
    `access_token=${jwt.sign({ sub, email: USERS[sub].email })}`;

  // ---- POST /companies/:companyId/users (criar funcionário) ----

  it('MASTER cria funcionário em qualquer empresa → 201 (role FUNCIONARIO)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${OTHER}/users`)
      .set('Cookie', cookie(1))
      .send({ nome: 'Novo', email: 'novo@x.com' })
      .expect(201);
    expect(res.body.data.tempPassword).toBeDefined();
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: SystemRole.FUNCIONARIO }),
    );
  });

  it('GERENTE cria funcionário na PRÓPRIA empresa → 201 (role forçado FUNCIONARIO)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${OWN}/users`)
      .set('Cookie', cookie(2))
      .send({ nome: 'Func', email: 'f2@x.com' })
      .expect(201);
    expect(res.body.data.tempPassword).toBeDefined();
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: SystemRole.FUNCIONARIO }),
    );
  });

  it('GERENTE cria em OUTRA empresa → 403 (CompanyAccessGuard)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${OTHER}/users`)
      .set('Cookie', cookie(2))
      .send({ nome: 'X', email: 'x@x.com' })
      .expect(403);
  });

  it('GERENTE tenta escalar papel (role no body) → 400 (whitelist)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${OWN}/users`)
      .set('Cookie', cookie(2))
      .send({ nome: 'Y', email: 'y@x.com', role: 'MASTER' })
      .expect(400);
  });

  // ⬇⬇ teste NOMEADO de defesa em profundidade (o que prova o RolesGuard) ⬇⬇
  it('DEFESA EM PROFUNDIDADE: FUNCIONARIO chamando POST /companies/{suaPrópriaEmpresa}/users → 403 (RolesGuard, não o CompanyAccessGuard)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${OWN}/users`) // a PRÓPRIA empresa → companyId casa
      .set('Cookie', cookie(3))
      .send({ nome: 'Z', email: 'z@x.com' })
      .expect(403);
  });

  // ---- GET /companies/:companyId/users (listar) ----

  it('GERENTE lista a PRÓPRIA empresa → 200 com role', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${OWN}/users`)
      .set('Cookie', cookie(2))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].role).toBe(SystemRole.FUNCIONARIO);
  });

  it('MASTER lista qualquer empresa → 200', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/companies/${OTHER}/users`)
      .set('Cookie', cookie(1))
      .expect(200);
  });

  it('GERENTE lista OUTRA empresa → 403 (CompanyAccessGuard)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/companies/${OTHER}/users`)
      .set('Cookie', cookie(2))
      .expect(403);
  });

  // ⬇⬇ teste NOMEADO de defesa em profundidade (GET) ⬇⬇
  it('DEFESA EM PROFUNDIDADE: FUNCIONARIO chamando GET /companies/{suaPrópriaEmpresa}/users → 403 (RolesGuard, não o CompanyAccessGuard)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/companies/${OWN}/users`)
      .set('Cookie', cookie(3))
      .expect(403);
  });

  it('Sem cookie → 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/companies/${OWN}/users`)
      .expect(401);
  });
});
