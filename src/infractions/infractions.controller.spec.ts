import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsController } from './infractions.controller';
import { InfractionsService } from './infractions.service';

describe('InfractionsController', () => {
  let controller: InfractionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfractionsController],
      providers: [
        {
          provide: InfractionsService,
          useValue: {
            create: () => ({}),
            findAll: () => [],
            findOne: () => ({}),
            analyze: () => ({}),
            generateDocument: () => Buffer.from(''),
            update: () => ({}),
            remove: () => undefined,
          },
        },
      ],
    }).compile();

    controller = module.get<InfractionsController>(InfractionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
