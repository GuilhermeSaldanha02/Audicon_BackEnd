import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { InfractionsController } from '../src/infractions/infractions.controller';
import { InfractionsService } from '../src/infractions/infractions.service';
import { InfractionAnalysisService } from '../src/infractions/infraction-analysis.service';
import { InfractionNotificationService } from '../src/infractions/infraction-notification.service';
import { Infraction } from '../src/infractions/entities/infraction.entity';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { InfractionAccessGuard } from '../src/common/guards/infraction-access.guard';
import { UsersService } from '../src/users/users.service';
import { SystemRole } from '../src/common/enums/system-role.enum';
import { setupApp } from '../src/setup-app';

/**
 * Fix pré-deploy: campo `severity` (gravidade) obrigatório na criação de infração.
 * Cobre a validação (ValidationPipe + @IsEnum) e a presença do campo na resposta.
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';
const USER = {
  id: 2,
  email: 'gerente@x.com',
  isMaster: false,
  companyId: 5,
  role: SystemRole.GERENTE,
};

describe('POST /infractions (e2e) — gravidade (severity) obrigatória', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const infractionsServiceMock = {
    create: jest.fn(async (dto: any) => ({
      id: 1,
      description: dto.description,
      severity: dto.severity,
      status: 'pending',
      occurrenceDate: new Date(),
    })),
  };

  const usersServiceMock = {
    findOneById: jest.fn(async (id: number) => (id === USER.id ? USER : null)),
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
      controllers: [InfractionsController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        InfractionAccessGuard,
        { provide: InfractionsService, useValue: infractionsServiceMock },
        { provide: InfractionAnalysisService, useValue: {} },
        { provide: InfractionNotificationService, useValue: {} },
        { provide: getRepositoryToken(Infraction), useValue: {} },
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

  const cookie = () =>
    `access_token=${jwt.sign({ sub: USER.id, email: USER.email })}`;

  it('com severity válido → 201 e campo presente na resposta', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/infractions')
      .set('Cookie', cookie())
      .send({ description: 'Barulho após 22h', severity: 'GRAVE', unitId: 10 })
      .expect(201);
    expect(res.body.data.severity).toBe('GRAVE');
  });

  it('sem severity → 400 (campo obrigatório)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/infractions')
      .set('Cookie', cookie())
      .send({ description: 'Barulho após 22h', unitId: 10 })
      .expect(400);
  });

  it('severity inválido → 400 (fora do enum)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/infractions')
      .set('Cookie', cookie())
      .send({ description: 'Barulho', severity: 'CRITICA', unitId: 10 })
      .expect(400);
  });
});
