import { Test, TestingModule } from '@nestjs/testing';
import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades.service';

describe('UnidadesController', () => {
  let controller: UnidadesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnidadesController],
      providers: [
        {
          provide: UnidadesService,
          useValue: {
            create: () => ({}),
            findAll: () => [],
            findOne: () => ({}),
            update: () => ({}),
            remove: () => undefined,
          },
        },
      ],
    }).compile();

    controller = module.get<UnidadesController>(UnidadesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
