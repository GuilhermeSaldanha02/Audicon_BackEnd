import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { UnitsController } from './../src/units/units.controller';
import { UnitsService } from './../src/units/units.service';
import { JwtStrategy } from './../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from './../src/common/guards/roles.guard';
import { CondominiumAccessGuard } from './../src/common/guards/condominium-access.guard';
import { UsersService } from './../src/users/users.service';
import { Condominium } from './../src/condominiums/entities/condominium.entity';
import { SystemRole } from './../src/common/enums/system-role.enum';
import { setupApp } from './../src/setup-app';

/**
 * R-03+04 — Prova de comportamento ponta a ponta do RBAC novo:
 * RolesGuard (papel) + CondominiumAccessGuard (tenant) atuando em conjunto
 * na rota PATCH /condominiums/:condominiumId/units/:id (exige GERENTE).
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';

describe('RBAC (e2e) — RolesGuard + CondominiumAccessGuard', () => {
  let app: INestApplication;
  let jwt: JwtService;

  // Condomínios em duas empresas distintas:
  //   condo 10 → empresa 1
  //   condo 20 → empresa 2
  const condosByIdCompany: Record<number, number> = { 10: 1, 20: 2 };

  // Usuários: gerente A (empresa 1), funcionário A (empresa 1), gerente B (empresa 2)
  const usersById: Record<number, any> = {
    1: {
      id: 1,
      email: 'g_a@x.com',
      isMaster: false,
      companyId: 1,
      role: SystemRole.GERENTE,
    },
    2: {
      id: 2,
      email: 'f_a@x.com',
      isMaster: false,
      companyId: 1,
      role: SystemRole.FUNCIONARIO,
    },
    3: {
      id: 3,
      email: 'g_b@x.com',
      isMaster: false,
      companyId: 2,
      role: SystemRole.GERENTE,
    },
  };

  const unitsServiceMock = {
    update: jest.fn(async (id: number, dto: any) => ({ id, ...dto })),
  };

  const condominiumQbMock = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn(function (this: any, _sql: string, params: any) {
      this._id = params.id;
      return this;
    }),
    getRawOne: jest.fn(function (this: any) {
      const companyId = condosByIdCompany[this._id];
      if (!companyId) return undefined;
      return { c_id: this._id, c_companyId: companyId };
    }),
  };
  const condominiumRepoMock = {
    createQueryBuilder: jest.fn(() => {
      // fresh qb por chamada
      const qb: any = { ...condominiumQbMock };
      qb.select = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn((_s: string, p: any) => {
        qb._id = p.id;
        return qb;
      });
      qb.getRawOne = jest.fn(async () => {
        const cid = condosByIdCompany[qb._id];
        return cid ? { c_id: qb._id, c_companyId: cid } : undefined;
      });
      return qb;
    }),
  };

  const usersServiceMock = {
    findOneById: jest.fn(async (id: number) => usersById[id]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [UnitsController],
      providers: [
        Reflector,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        CondominiumAccessGuard,
        { provide: UnitsService, useValue: unitsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        {
          provide: getRepositoryToken(Condominium),
          useValue: condominiumRepoMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return JWT_SECRET;
              if (key === 'CORS_ORIGINS') return 'http://localhost:3001';
              return undefined;
            }),
          },
        },
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

  const sign = (sub: number, email: string) => jwt.sign({ sub, email });

  it('GERENTE da Empresa A → PATCH unit do condomínio 10 (empresa 1): 200', async () => {
    const token = sign(1, 'g_a@x.com');
    await request(app.getHttpServer())
      .patch('/api/v1/condominiums/10/units/99')
      .set('Cookie', `access_token=${token}`)
      .send({ ownerName: 'Novo' })
      .expect(200);
    expect(unitsServiceMock.update).toHaveBeenCalled();
  });

  it('GERENTE da Empresa A → PATCH unit do condomínio 20 (empresa 2): 403 (CondominiumAccessGuard)', async () => {
    unitsServiceMock.update.mockClear();
    const token = sign(1, 'g_a@x.com');
    await request(app.getHttpServer())
      .patch('/api/v1/condominiums/20/units/99')
      .set('Cookie', `access_token=${token}`)
      .send({ ownerName: 'X' })
      .expect(403);
    expect(unitsServiceMock.update).not.toHaveBeenCalled();
  });

  it('FUNCIONARIO da Empresa A → PATCH unit (rota só GERENTE): 403 (RolesGuard)', async () => {
    unitsServiceMock.update.mockClear();
    const token = sign(2, 'f_a@x.com');
    await request(app.getHttpServer())
      .patch('/api/v1/condominiums/10/units/99')
      .set('Cookie', `access_token=${token}`)
      .send({ ownerName: 'X' })
      .expect(403);
    expect(unitsServiceMock.update).not.toHaveBeenCalled();
  });

  it('FUNCIONARIO da Empresa A → GET unit (rota GERENTE/FUNCIONARIO): 200', async () => {
    (unitsServiceMock as any).findOne = jest.fn(async (id: number) => ({ id }));
    const token = sign(2, 'f_a@x.com');
    await request(app.getHttpServer())
      .get('/api/v1/condominiums/10/units/99')
      .set('Cookie', `access_token=${token}`)
      .expect(200);
  });

  it('Sem cookie de autenticação: 401', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/condominiums/10/units/99')
      .send({ ownerName: 'X' })
      .expect(401);
  });
});
