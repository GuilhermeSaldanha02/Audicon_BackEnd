import { Test, TestingModule } from '@nestjs/testing';
import { UnidadesService } from './unidades.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Unidade } from './entities/unidade.entity';
import { CondominiosService } from '../condominios/condominios.service';

describe('UnidadesService', () => {
  let service: UnidadesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnidadesService,
        {
          provide: getRepositoryToken(Unidade),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOneBy: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CondominiosService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UnidadesService>(UnidadesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
