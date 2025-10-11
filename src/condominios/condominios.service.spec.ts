import { Test, TestingModule } from '@nestjs/testing';
import { CondominiosService } from './condominios.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Condominio } from './entities/condominio.entity';

describe('CondominiosService', () => {
  let service: CondominiosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondominiosService,
        {
          provide: getRepositoryToken(Condominio),
          useValue: {
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => x),
            find: jest.fn(async () => []),
            findOne: jest.fn(async () => null),
            preload: jest.fn(async () => null),
            remove: jest.fn(async (x) => x),
          },
        },
      ],
    }).compile();

    service = module.get<CondominiosService>(CondominiosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
