import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsService } from './infractions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infraction } from './entities/infraction.entity';
import { UnitsService } from '../units/units.service';
import { IaService } from '../ia/ia.service';
import { PdfService } from '../pdf/pdf.service';

describe('InfractionsService', () => {
  let service: InfractionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfractionsService,
        {
          provide: getRepositoryToken(Infraction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: UnitsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: IaService,
          useValue: {
            analisarInfracao: jest.fn(),
          },
        },
        {
          provide: PdfService,
          useValue: {
            gerarDocumentoInfracao: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InfractionsService>(InfractionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
