import { Test, TestingModule } from '@nestjs/testing';
import { InfracoesService } from './infracoes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infracao } from './entities/infracao.entity';
import { UnidadesService } from '../unidades/unidades.service';
import { IaService } from '../ia/ia.service';
import { PdfService } from '../pdf/pdf.service';

describe('InfracoesService', () => {
  let service: InfracoesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfracoesService,
        {
          provide: getRepositoryToken(Infracao),
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
          provide: UnidadesService,
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

    service = module.get<InfracoesService>(InfracoesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
