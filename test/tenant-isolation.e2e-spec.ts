import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UsersService } from '../src/users/users.service';
import { SystemRole } from '../src/common/enums/system-role.enum';
import { setupApp } from '../src/setup-app';

import { CondominiumsController } from '../src/condominiums/condominiums.controller';
import { CondominiumsService } from '../src/condominiums/condominiums.service';
import { Condominium } from '../src/condominiums/entities/condominium.entity';

import { InfractionsController } from '../src/infractions/infractions.controller';
import { InfractionsService } from '../src/infractions/infractions.service';
import { InfractionAnalysisService } from '../src/infractions/infraction-analysis.service';
import { InfractionNotificationService } from '../src/infractions/infraction-notification.service';
import { Infraction } from '../src/infractions/entities/infraction.entity';
import { UnitsService } from '../src/units/units.service';

import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';
import { AuditLog } from '../src/audit/entities/audit-log.entity';

import { DashboardController } from '../src/dashboard/dashboard.controller';
import { DashboardService } from '../src/dashboard/dashboard.service';

/**
 * R-05 — Prova de isolamento de tenant nas rotas de listagem/agregação.
 *
 * Cada caso cria dados em duas empresas distintas e verifica que o gerente
 * da Empresa A recebe APENAS dados da sua empresa — assertNotContains(dadosDaEmpresaB).
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';

const USERS: Record<number, any> = {
  1: {
    id: 1,
    email: 'g_a@empresa-a.com',
    isMaster: false,
    companyId: 1,
    role: SystemRole.GERENTE,
  },
  2: {
    id: 2,
    email: 'g_b@empresa-b.com',
    isMaster: false,
    companyId: 2,
    role: SystemRole.GERENTE,
  },
  99: {
    id: 99,
    email: 'master@audicon.com',
    isMaster: true,
    companyId: null,
    role: SystemRole.GERENTE,
  },
};

const configMock = {
  get: (key: string) => {
    if (key === 'JWT_SECRET') return JWT_SECRET;
    if (key === 'CORS_ORIGINS') return 'http://localhost:3001';
    return undefined;
  },
};

const usersServiceMock = {
  findOneById: jest.fn(async (id: number) => USERS[id]),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sign(jwt: JwtService, userId: number): string {
  return jwt.sign({ sub: userId, email: USERS[userId].email });
}

// Smart query-builder that captures companyId from WHERE/andWhere and filters data.
function makeFilteringQb<T extends { companyId?: number | null }>(
  allData: T[],
  companyField: (item: T) => number | null | undefined,
) {
  let filterCompanyId: number | undefined;
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn((sql: string, params: any) => {
      if (sql.includes('companyId') && params?.companyId != null) {
        filterCompanyId = params.companyId;
      }
      return qb;
    }),
    andWhere: jest.fn((sql: string, params: any) => {
      if (sql.includes('companyId') && params?.companyId != null) {
        filterCompanyId = params.companyId;
      }
      return qb;
    }),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    clone: jest.fn(() => qb),
    getMany: jest.fn(async () => {
      return filterCompanyId != null
        ? allData.filter((i) => companyField(i) === filterCompanyId)
        : allData;
    }),
    getManyAndCount: jest.fn(async () => {
      const filtered =
        filterCompanyId != null
          ? allData.filter((i) => companyField(i) === filterCompanyId)
          : allData;
      return [filtered, filtered.length];
    }),
    getCount: jest.fn(async () => {
      return filterCompanyId != null
        ? allData.filter((i) => companyField(i) === filterCompanyId).length
        : allData.length;
    }),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    qb,
    resetFilter: () => {
      filterCompanyId = undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const condoAlpha = {
  id: 1,
  name: 'Condo-Alpha',
  companyId: 1,
  cnpj: '11.111.111/0001-11',
  address: 'Rua A, 1',
};
const condoBeta = {
  id: 2,
  name: 'Condo-Beta',
  companyId: 2,
  cnpj: '22.222.222/0001-22',
  address: 'Rua B, 2',
};

const infrA = {
  id: 1,
  description: 'INFR-A-XYZ',
  status: 'pending',
  occurrenceDate: new Date('2025-01-10'),
  approvedAt: null,
  sentAt: null,
  unit: {
    id: 10,
    identifier: 'UA-101',
    condominium: { id: 1, name: 'Condo-Alpha', companyId: 1 },
  },
};
const infrB = {
  id: 2,
  description: 'INFR-B-ZZZ',
  status: 'pending',
  occurrenceDate: new Date('2025-01-15'),
  approvedAt: null,
  sentAt: null,
  unit: {
    id: 20,
    identifier: 'UB-101',
    condominium: { id: 2, name: 'Condo-Beta', companyId: 2 },
  },
};

const auditA = {
  id: 1,
  companyId: 1,
  action: 'CONDOMINIUM_CREATED',
  entity: 'condominium',
  userEmail: 'g_a@empresa-a.com',
  createdAt: new Date(),
};
const auditB = {
  id: 2,
  companyId: 2,
  action: 'CONDOMINIUM_CREATED',
  entity: 'condominium',
  userEmail: 'g_b@empresa-b.com',
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Tenant Isolation (e2e) — assertTenantScope nas rotas de listagem', () => {
  // -------------------------------------------------------------------------
  // 1. GET /condominiums
  // -------------------------------------------------------------------------
  describe('GET /condominiums', () => {
    let app: INestApplication;
    let jwt: JwtService;
    let resetFilter: () => void;

    beforeAll(async () => {
      const { qb, resetFilter: rf } = makeFilteringQb(
        [condoAlpha, condoBeta],
        (c) => c.companyId,
      );
      resetFilter = rf;

      const condoRepoMock = {
        createQueryBuilder: jest.fn(() => {
          resetFilter();
          return qb;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
        controllers: [CondominiumsController],
        providers: [
          JwtStrategy,
          JwtAuthGuard,
          CondominiumsService,
          { provide: getRepositoryToken(Condominium), useValue: condoRepoMock },
          { provide: AuditService, useValue: { log: jest.fn() } },
          { provide: UsersService, useValue: usersServiceMock },
          { provide: ConfigService, useValue: configMock },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useClass(JwtAuthGuard)
        .compile();

      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      jwt = module.get(JwtService);
    });

    afterAll(() => app.close());

    it('Gerente A: vê apenas Condo-Alpha — response não contém Condo-Beta', async () => {
      const token = sign(jwt, 1);
      const res = await request(app.getHttpServer())
        .get('/api/v1/condominiums')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(1);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe('Condo-Alpha');
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('Condo-Beta');
    });

    it('Master: vê ambos os condomínios (Condo-Alpha e Condo-Beta)', async () => {
      const token = sign(jwt, 99);
      const res = await request(app.getHttpServer())
        .get('/api/v1/condominiums')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(2);
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).toContain('Condo-Alpha');
      expect(bodyStr).toContain('Condo-Beta');
    });
  });

  // -------------------------------------------------------------------------
  // 2. GET /infractions
  // -------------------------------------------------------------------------
  describe('GET /infractions', () => {
    let app: INestApplication;
    let jwt: JwtService;
    let resetFilter: () => void;

    beforeAll(async () => {
      const { qb, resetFilter: rf } = makeFilteringQb(
        [infrA, infrB],
        (i: any) => i.unit.condominium.companyId,
      );
      resetFilter = rf;

      const infrRepoMock = {
        createQueryBuilder: jest.fn(() => {
          resetFilter();
          return qb;
        }),
        manager: { createQueryBuilder: jest.fn(() => qb) },
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
        controllers: [InfractionsController],
        providers: [
          JwtStrategy,
          JwtAuthGuard,
          InfractionsService,
          { provide: getRepositoryToken(Infraction), useValue: infrRepoMock },
          { provide: UnitsService, useValue: { findOne: jest.fn() } },
          { provide: CondominiumsService, useValue: { findOne: jest.fn() } },
          { provide: AuditService, useValue: { log: jest.fn() } },
          { provide: UsersService, useValue: usersServiceMock },
          { provide: ConfigService, useValue: configMock },
          { provide: InfractionAnalysisService, useValue: {} },
          { provide: InfractionNotificationService, useValue: {} },
        ],
      }).compile();

      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      jwt = module.get(JwtService);
    });

    afterAll(() => app.close());

    it('Gerente A: vê apenas INFR-A-XYZ — response não contém INFR-B-ZZZ', async () => {
      const token = sign(jwt, 1);
      const res = await request(app.getHttpServer())
        .get('/api/v1/infractions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(1);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].description).toBe('INFR-A-XYZ');
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('INFR-B-ZZZ');
      expect(bodyStr).not.toContain('Condo-Beta');
    });

    it('Gerente B: vê apenas INFR-B-ZZZ — response não contém INFR-A-XYZ', async () => {
      const token = sign(jwt, 2);
      const res = await request(app.getHttpServer())
        .get('/api/v1/infractions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(1);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].description).toBe('INFR-B-ZZZ');
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('INFR-A-XYZ');
      expect(bodyStr).not.toContain('Condo-Alpha');
    });
  });

  // -------------------------------------------------------------------------
  // 3. GET /infractions/export (CSV)
  // -------------------------------------------------------------------------
  describe('GET /infractions/export (CSV)', () => {
    let app: INestApplication;
    let jwt: JwtService;
    let resetFilter: () => void;

    beforeAll(async () => {
      const { qb, resetFilter: rf } = makeFilteringQb(
        [infrA, infrB],
        (i: any) => i.unit.condominium.companyId,
      );
      resetFilter = rf;

      const infrRepoMock = {
        createQueryBuilder: jest.fn(() => {
          resetFilter();
          return qb;
        }),
        manager: { createQueryBuilder: jest.fn(() => qb) },
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
        controllers: [InfractionsController],
        providers: [
          JwtStrategy,
          JwtAuthGuard,
          InfractionsService,
          { provide: getRepositoryToken(Infraction), useValue: infrRepoMock },
          { provide: UnitsService, useValue: { findOne: jest.fn() } },
          { provide: CondominiumsService, useValue: { findOne: jest.fn() } },
          { provide: AuditService, useValue: { log: jest.fn() } },
          { provide: UsersService, useValue: usersServiceMock },
          { provide: ConfigService, useValue: configMock },
          { provide: InfractionAnalysisService, useValue: {} },
          { provide: InfractionNotificationService, useValue: {} },
        ],
      }).compile();

      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      jwt = module.get(JwtService);
    });

    afterAll(() => app.close());

    it('Gerente A: CSV contém INFR-A-XYZ e NÃO contém INFR-B-ZZZ nem Condo-Beta', async () => {
      const token = sign(jwt, 1);
      const res = await request(app.getHttpServer())
        .get('/api/v1/infractions/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const csv: string = res.text;
      expect(csv).toContain('INFR-A-XYZ');
      expect(csv).not.toContain('INFR-B-ZZZ');
      expect(csv).not.toContain('Condo-Beta');
    });
  });

  // -------------------------------------------------------------------------
  // 4+6. GET /dashboard — Gerente A (isolado) e Master (vê tudo)
  // -------------------------------------------------------------------------
  describe('GET /dashboard', () => {
    let app: INestApplication;
    let jwt: JwtService;

    beforeAll(async () => {
      // Dashboard usa clone() e múltiplos getRawMany/getCount.
      // O QB retorna count baseado na presença do filtro de companyId.
      let hasCompanyFilter = false;

      const dashboardQb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn((sql: string) => {
          if (sql.includes('companyId')) hasCompanyFilter = true;
          return dashboardQb;
        }),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        clone: jest.fn(() => dashboardQb),
        getCount: jest.fn(async () => (hasCompanyFilter ? 1 : 2)),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const infrRepoMock = {
        createQueryBuilder: jest.fn(() => {
          hasCompanyFilter = false;
          return dashboardQb;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
        controllers: [DashboardController],
        providers: [
          JwtStrategy,
          JwtAuthGuard,
          DashboardService,
          { provide: getRepositoryToken(Infraction), useValue: infrRepoMock },
          { provide: UsersService, useValue: usersServiceMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      jwt = module.get(JwtService);
    });

    afterAll(() => app.close());

    it('Gerente A: totalInfractions=1 (apenas empresa A)', async () => {
      const token = sign(jwt, 1);
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.totalInfractions).toBe(1);
    });

    it('Master: totalInfractions=2 (sem filtro — vê as duas empresas)', async () => {
      const token = sign(jwt, 99);
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.totalInfractions).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // 5. GET /audit-log
  // -------------------------------------------------------------------------
  describe('GET /audit-log', () => {
    let app: INestApplication;
    let jwt: JwtService;
    let resetFilter: () => void;

    beforeAll(async () => {
      const { qb, resetFilter: rf } = makeFilteringQb(
        [auditA, auditB],
        (a) => a.companyId,
      );
      resetFilter = rf;

      const auditRepoMock = {
        createQueryBuilder: jest.fn(() => {
          resetFilter();
          return qb;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
        controllers: [AuditController],
        providers: [
          JwtStrategy,
          JwtAuthGuard,
          AuditService,
          { provide: getRepositoryToken(AuditLog), useValue: auditRepoMock },
          { provide: UsersService, useValue: usersServiceMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      app = module.createNestApplication();
      setupApp(app);
      await app.init();
      jwt = module.get(JwtService);
    });

    afterAll(() => app.close());

    it('Gerente A: vê apenas logs da empresa A — nenhuma entrada da empresa B', async () => {
      const token = sign(jwt, 1);
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(1);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].companyId).toBe(1);
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('g_b@empresa-b.com');
    });

    it('Master sem filtro: vê todos os logs (empresa A e empresa B)', async () => {
      const token = sign(jwt, 99);
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = res.body.data;
      expect(data.total).toBe(2);
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).toContain('g_a@empresa-a.com');
      expect(bodyStr).toContain('g_b@empresa-b.com');
    });
  });
});
