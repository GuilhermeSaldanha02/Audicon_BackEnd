import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsService } from './condominiums.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Condominium } from './entities/condominium.entity';

describe('CondominiumsService', () => {
  let service: CondominiumsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondominiumsService,
        {
          provide: getRepositoryToken(Condominium),
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

    service = module.get<CondominiumsService>(CondominiumsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
