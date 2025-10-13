import { Test, TestingModule } from '@nestjs/testing';
import { IaService } from './ia.service';
import { ConfigService } from '@nestjs/config';

describe('IaService', () => {
  let service: IaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'GEMINI_API_KEY') return undefined;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IaService>(IaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
