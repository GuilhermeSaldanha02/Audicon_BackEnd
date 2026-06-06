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
 * R-16 — GERENTE edita (nome/e-mail) e desativa (soft-delete) FUNCIONÁRIO da
 * PRÓPRIA empresa. Cobre RBAC (RolesGuard + CompanyAccessGuard, espelho do R-15),
 * anti-escalonamento (role no body → 400), e o escopo do ALVO (só FUNCIONARIO,
 * nunca master/gerente) aplicado no service.
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';
const OWN = 5;
const OTHER = 6;

// Principais autenticados (req.user via JwtStrategy → findOneById)
const USERS: Record<number, any> = {
  1: { id: 1, email: 'master@x.com', isMaster: true, companyId: null, role: SystemRole.MASTER }, // prettier-ignore
  2: { id: 2, email: 'gerente@x.com', isMaster: false, companyId: OWN, role: SystemRole.GERENTE }, // prettier-ignore
  3: { id: 3, email: 'func@x.com', isMaster: false, companyId: OWN, role: SystemRole.FUNCIONARIO }, // prettier-ignore
};

// Alvos da operação (usersRepository.findOne({ where: { id } }))
const TARGETS: Record<number, any> = {
  10: { id: 10, nome: 'Func A', email: 'a@x.com', companyId: OWN, isMaster: false, role: SystemRole.FUNCIONARIO }, // prettier-ignore
  11: { id: 11, nome: 'Gerente B', email: 'b@x.com', companyId: OWN, isMaster: false, role: SystemRole.GERENTE }, // prettier-ignore
  12: { id: 12, nome: 'Func C', email: 'c@x.com', companyId: OTHER, isMaster: false, role: SystemRole.FUNCIONARIO }, // prettier-ignore
  13: { id: 13, nome: 'Master Y', email: 'm@x.com', companyId: OWN, isMaster: true, role: SystemRole.MASTER }, // prettier-ignore
};

describe('Company employees manage (e2e) — R-16 editar/desativar', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const companyRepo = {
    findOneBy: jest.fn(async ({ id }: { id: number }) => ({
      id,
      name: 'Empresa',
    })),
  };
  const userRepo = {
    findOne: jest.fn(async ({ where: { id } }: any) => TARGETS[id] ?? null),
    save: jest.fn(async (u: any) => u),
    softDelete: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(),
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
    userRepo.save.mockClear();
    userRepo.softDelete.mockClear();
    auditMock.log.mockClear();
  });

  const cookie = (sub: number) =>
    `access_token=${jwt.sign({ sub, email: USERS[sub].email })}`;

  // ---------- PATCH editar ----------

  it('MASTER edita funcionário → 200 (nome atualizado)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10`)
      .set('Cookie', cookie(1))
      .send({ nome: 'Novo Nome' })
      .expect(200);
    expect(res.body.data).toMatchObject({ id: 10, nome: 'Novo Nome' });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_UPDATED' }),
    );
  });

  it('GERENTE edita funcionário da PRÓPRIA empresa → 200', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10`)
      .set('Cookie', cookie(2))
      .send({ email: 'novo@x.com' })
      .expect(200);
  });

  it('editar com `role` no body → 400 (whitelist anti-escalonamento)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10`)
      .set('Cookie', cookie(2))
      .send({ nome: 'X', role: 'GERENTE' })
      .expect(400);
  });

  it('GERENTE edita em OUTRA empresa → 403 (CompanyAccessGuard)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OTHER}/users/12`)
      .set('Cookie', cookie(2))
      .send({ nome: 'X' })
      .expect(403);
  });

  it('FUNCIONARIO editando → 403 (RolesGuard, defesa em profundidade)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/10`)
      .set('Cookie', cookie(3))
      .send({ nome: 'X' })
      .expect(403);
  });

  it('GERENTE edita alvo GERENTE → 403 (escopo: só FUNCIONARIO)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/11`)
      .set('Cookie', cookie(2))
      .send({ nome: 'X' })
      .expect(403);
  });

  it('MASTER edita alvo master → 403 (MASTER não regride)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/companies/${OWN}/users/13`)
      .set('Cookie', cookie(1))
      .send({ nome: 'X' })
      .expect(403);
  });

  // ---------- DELETE desativar (soft-delete) ----------

  it('GERENTE desativa funcionário da própria empresa → 200 (softDelete, não delete físico)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/companies/${OWN}/users/10`)
      .set('Cookie', cookie(2))
      .expect(200);
    expect(res.body.data).toEqual({ id: 10 });
    expect(userRepo.softDelete).toHaveBeenCalledWith(10);
    expect(userRepo.delete).not.toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_DEACTIVATED' }),
    );
  });

  it('GERENTE desativa em OUTRA empresa → 403 (CompanyAccessGuard)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${OTHER}/users/12`)
      .set('Cookie', cookie(2))
      .expect(403);
  });

  it('FUNCIONARIO desativando → 403 (RolesGuard)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${OWN}/users/10`)
      .set('Cookie', cookie(3))
      .expect(403);
  });

  it('GERENTE desativa alvo GERENTE → 403 (escopo: só FUNCIONARIO)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${OWN}/users/11`)
      .set('Cookie', cookie(2))
      .expect(403);
    expect(userRepo.softDelete).not.toHaveBeenCalled();
  });

  it('sem cookie → 401', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${OWN}/users/10`)
      .expect(401);
  });
});
