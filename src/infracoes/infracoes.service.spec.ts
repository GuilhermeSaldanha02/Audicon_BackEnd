import { Test, TestingModule } from '@nestjs/testing';
import { InfracoesService } from './infracoes.service';

describe('InfracoesService', () => {
  let service: InfracoesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InfracoesService],
    }).compile();

    service = module.get<InfracoesService>(InfracoesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
