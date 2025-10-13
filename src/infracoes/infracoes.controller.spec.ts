import { Test, TestingModule } from '@nestjs/testing';
import { InfracoesController } from './infracoes.controller';
import { InfracoesService } from './infracoes.service';

describe('InfracoesController', () => {
  let controller: InfracoesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfracoesController],
      providers: [
        {
          provide: InfracoesService,
          useValue: {
            create: () => ({}),
            findAll: () => [],
            findOne: () => ({}),
            analisar: () => ({}),
            gerarDocumento: () => Buffer.from(''),
            update: () => ({}),
            remove: () => undefined,
          },
        },
      ],
    }).compile();

    controller = module.get<InfracoesController>(InfracoesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
