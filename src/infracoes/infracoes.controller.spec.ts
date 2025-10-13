import { Test, TestingModule } from '@nestjs/testing';
import { InfracoesController } from './infracoes.controller';

describe('InfracoesController', () => {
  let controller: InfracoesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfracoesController],
    }).compile();

    controller = module.get<InfracoesController>(InfracoesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
