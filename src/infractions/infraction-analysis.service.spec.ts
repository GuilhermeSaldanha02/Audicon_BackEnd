import { Test, TestingModule } from '@nestjs/testing';
import { InfractionAnalysisService } from './infraction-analysis.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { IaService } from '../ia/ia.service';
import { NotFoundException } from '@nestjs/common';

describe('InfractionAnalysisService', () => {
  let service: InfractionAnalysisService;
  let repo: any;
  let ia: any;
  let qb: any;

  const mockInfraction: Infraction = {
    id: 1,
    description: 'Desc',
    formalDescription: 'Formal',
    suggestedPenalty: 'Warning',
    status: InfractionStatus.PENDING,
    occurrenceDate: new Date('2024-06-08T10:00:00Z'),
    updatedAt: new Date('2024-06-08T10:00:00Z'),
    approvedAt: null,
    sentAt: null,
    whatsappSentAt: null,
    deletedAt: null,
    images: [] as any,
    unit: {
      id: 10,
      identifier: 'A101',
      ownerName: 'John Doe',
      residentEmail: 'morador@teste.com',
      residentPhone: '11999998888',
      condominium: { id: 5, name: 'Condo Alpha' } as any,
      infractions: [] as any,
    } as any,
  };

  beforeEach(async () => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
      clone: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfractionAnalysisService,
        {
          provide: getRepositoryToken(Infraction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            softDelete: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
        },
        {
          provide: IaService,
          useValue: {
            analisarInfracao: jest.fn(),
            extractRegimentoText: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<InfractionAnalysisService>(InfractionAnalysisService);
    repo = module.get(getRepositoryToken(Infraction));
    ia = module.get(IaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyze', () => {
    it('atualiza com campos em português e status ANALYZED', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...mockInfraction });
      (ia.analisarInfracao as jest.Mock).mockResolvedValue({
        descricao_formal: 'Formal PT',
        penalidade_sugerida: 'Advertência',
      });
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      (qb.getCount as jest.Mock)
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(1); // last12months
      const result = await service.analyze(1);
      expect(result.formalDescription).toBe('Formal PT');
      expect(result.suggestedPenalty).toBe('Advertência');
      expect(result.status).toBe(InfractionStatus.ANALYZED);
      expect(ia.analisarInfracao).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        { total: 2, last12months: 1 },
      );
    });

    it('aceita campos em inglês', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...mockInfraction });
      (ia.analisarInfracao as jest.Mock).mockResolvedValue({
        formalDescription: 'Formal EN',
        suggestedPenalty: 'Warning',
      });
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.analyze(2);
      expect(result.formalDescription).toBe('Formal EN');
      expect(result.suggestedPenalty).toBe('Warning');
      expect(result.status).toBe(InfractionStatus.ANALYZED);
    });
  });

  describe('countByUnit', () => {
    it('retorna total e last12months a partir dos query builders', async () => {
      (qb.getCount as jest.Mock)
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3); // last12months
      const result = await service.countByUnit(10);
      expect(result).toEqual({ total: 5, last12months: 3 });
      expect(qb.where).toHaveBeenCalledWith('unit.id = :unitId', {
        unitId: 10,
      });
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'i.id != :excludeId',
        expect.anything(),
      );
    });

    it('exclui infração informada via excludeId', async () => {
      (qb.getCount as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      const result = await service.countByUnit(10, 99);
      expect(result).toEqual({ total: 0, last12months: 0 });
      expect(qb.andWhere).toHaveBeenCalledWith('i.id != :excludeId', {
        excludeId: 99,
      });
    });

    it('retorna zeros quando unidade não tem infrações', async () => {
      (qb.getCount as jest.Mock).mockResolvedValue(0);
      const result = await service.countByUnit(42);
      expect(result).toEqual({ total: 0, last12months: 0 });
    });
  });
});
