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
 * R-17 — MASTER promove/rebaixa papel de usuário em uma empresa.
 *
 * Cobre os 7 cenários do contrato:
 * 1. promover FUNCIONARIO→GERENTE (empresa sem gerente) → 200
 * 2. promover 2º FUNCIONARIO com gerente ativo → 409
 * 3. rebaixar GERENTE→FUNCIONARIO → 200
 * 4. GERENTE tenta a rota → 403 (MasterGuard)
 * 5. MASTER tenta alvo de outra empresa → 404
 * 6. role igual ao atual → 400
 * 7. MASTER no body → 400 (whitelist)
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';
const OWN = 5;
const OTHER = 6;

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
};

const TARGETS: Record<number, any> = {
  10: {
    id: 10,
    nome: 'Func A',
    email: 'a@x.com',
    companyId: OWN,
    isMaster: false,
    role: SystemRole.FUNCIONARIO,
    deletedAt: null,
  },
  11: {
    id: 11,
    nome: 'Gerente B',
    email: 'b@x.com',
    companyId: OWN,
    isMaster: false,
    role: SystemRole.GERENTE,
    deletedAt: null,
  },
  12: {
    id: 12,
    nome: 'Func C',
    email: 'c@x.com',
    companyId: OTHER,
    isMaster: false,
    role: SystemRole.FUNCIONARIO,
    deletedAt: null,
  },
};

describe('Company role change (e2e) — R-17', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const companyRepo = {
    findOneBy: jest.fn(async ({ id }: { id: number }) => ({
      id,
      name: 'Empresa',
    })),
  };

  // findOne é usado em sequência: primeiro findEmployeeForRoleChange, depois o
  // check de gerente ativo. Controlamos por .mockResolvedValueOnce encadeados
  // nos testes que precisam de dois calls.
  const userRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (u: any) => u),
    softDelete: jest.fn(),
    delete: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const usersServiceMock = {
    findOneById: jest.fn(async (id: number) => USERS[id]),
  };
  const auditMock = { log: jest.fn() };
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
        { provide: AuditService, useValue: auditMock },
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

  beforeEach(() => {
    userRepo.findOne.mockReset();
    userRepo.save.mockClear();
    auditMock.log.mockClear();
  });

  const cookie = (sub: number) =>
    `access_token=${jwt.sign({ sub, email: USERS[sub].email })}`;

  // 1 — promover FUNCIONARIO→GERENTE (empresa sem gerente) → 200
  it('MASTER promove FUNCIONARIO→GERENTE sem gerente ativo → 200', async () => {
    userRepo.findOne
      .mockResolvedValueOnce({ ...TARGETS[10] }) // findEmployeeForRoleChange
      .mockResolvedValueOnce(null); // check: nenhum gerente ativo

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10/role`)
      .set('Cookie', cookie(1))
      .send({ role: 'GERENTE' })
      .expect(200);

    expect(res.body.data).toMatchObject({ id: 10, role: SystemRole.GERENTE });
  });

  // 2 — promover 2º FUNCIONARIO com gerente ativo → 409
  it('MASTER promove com gerente ativo → 409', async () => {
    userRepo.findOne
      .mockResolvedValueOnce({ ...TARGETS[10] }) // findEmployeeForRoleChange
      .mockResolvedValueOnce({ ...TARGETS[11] }); // check: gerente ativo encontrado

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10/role`)
      .set('Cookie', cookie(1))
      .send({ role: 'GERENTE' })
      .expect(409);

    expect(res.body.response.message).toMatch(/gerente ativo/);
  });

  // 3 — rebaixar GERENTE→FUNCIONARIO → 200 (libera a vaga)
  it('MASTER rebaixa GERENTE→FUNCIONARIO → 200', async () => {
    userRepo.findOne.mockResolvedValueOnce({ ...TARGETS[11] }); // findEmployeeForRoleChange

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/11/role`)
      .set('Cookie', cookie(1))
      .send({ role: 'FUNCIONARIO' })
      .expect(200);

    expect(res.body.data).toMatchObject({
      id: 11,
      role: SystemRole.FUNCIONARIO,
    });
  });

  // 4 — GERENTE tenta a rota → 403 (MasterGuard)
  it('GERENTE tenta alterar papel → 403 (MasterGuard)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10/role`)
      .set('Cookie', cookie(2))
      .send({ role: 'GERENTE' })
      .expect(403);
  });

  // 5 — MASTER tenta alvo de outra empresa → 404
  it('MASTER tenta alvo de outra empresa → 404 (não vaza cross-tenant)', async () => {
    userRepo.findOne.mockResolvedValueOnce({ ...TARGETS[12] }); // companyId OTHER

    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/12/role`)
      .set('Cookie', cookie(1))
      .send({ role: 'GERENTE' })
      .expect(404);
  });

  // 6 — role igual ao atual → 400
  it('role igual ao atual → 400', async () => {
    userRepo.findOne.mockResolvedValueOnce({ ...TARGETS[10] }); // já é FUNCIONARIO

    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10/role`)
      .set('Cookie', cookie(1))
      .send({ role: 'FUNCIONARIO' })
      .expect(400);
  });

  // 7 — MASTER no body → 400 (whitelist do ChangeRoleDto)
  it('role MASTER no body → 400 (whitelist ChangeRoleDto)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10/role`)
      .set('Cookie', cookie(1))
      .send({ role: 'MASTER' })
      .expect(400);
  });
});
