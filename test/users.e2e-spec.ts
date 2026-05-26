import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { UsersController } from './../src/users/users.controller';
import { UsersService } from './../src/users/users.service';
import { JwtStrategy } from './../src/auth/strategies/jwt.strategy';
import { MasterGuard } from './../src/common/guards/master.guard';
import { setupApp } from './../src/setup-app';

/**
 * Hotfix de segurança (R1): POST /users deixou de ser público.
 * Estes testes provam o COMPORTAMENTO real do pipeline de guards
 * (JwtAuthGuard + MasterGuard), sem depender de banco de dados.
 */
const JWT_SECRET = 'test-secret-at-least-16-chars';

describe('POST /api/v1/users (e2e — proteção R1)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  // Banco fake: o JwtStrategy.validate() recarrega o usuário por id.
  const usersById: Record<number, any> = {
    1: { id: 1, email: 'master@audicon.com', isMaster: true, companyId: null },
    2: { id: 2, email: 'func@empresa.com', isMaster: false, companyId: 1 },
  };

  const usersServiceMock = {
    create: jest.fn(async (dto: any) => ({ id: 99, ...dto, senha: 'hashed' })),
    findOneById: jest.fn(async (id: number) => usersById[id]),
    findOneByEmail: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [UsersController],
      providers: [
        JwtStrategy,
        MasterGuard,
        { provide: UsersService, useValue: usersServiceMock },
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
    setupApp(app); // aplica prefixo api/v1 + pipes/filtros globais
    await app.init();

    jwt = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const validBody = {
    nome: 'Maria Souza',
    email: 'maria@email.com',
    senha: 'S3nh@Segura',
  };

  it('rejeita requisição SEM autenticação com 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send(validBody)
      .expect(401);

    expect(usersServiceMock.create).not.toHaveBeenCalled();
  });

  it('rejeita usuário autenticado NÃO-master com 403', async () => {
    const token = jwt.sign({ sub: 2, email: 'func@empresa.com' });

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
      .expect(403);

    expect(usersServiceMock.create).not.toHaveBeenCalled();
  });

  it('permite usuário master (201) e omite a senha do retorno', async () => {
    const token = jwt.sign({ sub: 1, email: 'master@audicon.com' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
      .expect(201);

    expect(usersServiceMock.create).toHaveBeenCalledWith(validBody);
    // ResponseInterceptor envelopa em { statusCode, data }
    const payload = res.body.data ?? res.body;
    expect(payload.senha).toBeUndefined();
    expect(payload.email).toBe(validBody.email);
  });
});
