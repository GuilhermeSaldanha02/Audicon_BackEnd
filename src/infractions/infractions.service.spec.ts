import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsService } from './infractions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { UnitsService } from '../units/units.service';
import { IaService } from '../ia/ia.service';
import { PdfService } from '../pdf/pdf.service';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
describe('InfractionsService', () => {
  let service: InfractionsService;
  let repo: any;
  let units: any;
  let ia: any;
  let pdf: any;
  let condos: any;
  let qb: any;
  const mockInfraction: Infraction = {
    id: 1,
    description: 'Desc',
    formalDescription: 'Formal',
    suggestedPenalty: 'Warning',
    status: InfractionStatus.PENDING,
    occurrenceDate: new Date('2024-06-08T10:00:00Z'),
    updatedAt: new Date('2024-06-08T10:00:00Z'),
    unit: {
      id: 10,
      identifier: 'A101',
      ownerName: 'John Doe',
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
    };
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
            createQueryBuilder: jest.fn(() => qb),
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
            streamInfractionReport: jest.fn(),
          },
        },
        {
          provide: CondominiumsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get<InfractionsService>(InfractionsService);
    repo = module.get(getRepositoryToken(Infraction));
    units = module.get(UnitsService);
    ia = module.get(IaService);
    pdf = module.get(PdfService);
    condos = module.get(CondominiumsService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('create', () => {
    it('cria infração com unidade existente', async () => {
      const dto = { description: 'Teste', unitId: 10 } as any;
      (units.findOne as jest.Mock).mockResolvedValue(mockInfraction.unit);
      (repo.create as jest.Mock).mockReturnValue({
        ...mockInfraction,
        id: undefined,
      });
      (repo.save as jest.Mock).mockResolvedValue({ ...mockInfraction });
      const result = await service.create(dto);
      expect(units.findOne).toHaveBeenCalledWith(10);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(mockInfraction);
    });
  });
  describe('findAll', () => {
    const pagination = { page: 1, limit: 20 };

    it('retorna resultado paginado sem filtro', async () => {
      qb.getManyAndCount.mockResolvedValue([[mockInfraction], 1]);
      const result = await service.findAll(pagination);
      expect(result).toEqual({
        data: [mockInfraction],
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('filtra por unidade quando unitId fornecido', async () => {
      (units.findOne as jest.Mock).mockResolvedValue(mockInfraction.unit);
      qb.getManyAndCount.mockResolvedValue([[mockInfraction], 1]);
      const result = await service.findAll(pagination, 10);
      expect(units.findOne).toHaveBeenCalledWith(10);
      expect(qb.where).toHaveBeenCalledWith('unit.id = :unitId', {
        unitId: 10,
      });
      expect(result.data).toEqual([mockInfraction]);
    });

    it('lança NotFoundException quando unitId não existe', async () => {
      (units.findOne as jest.Mock).mockRejectedValue(new NotFoundException());
      await expect(service.findAll(pagination, 999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('aplica skip e take corretos para page 2', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 2, limit: 10 });
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });
  describe('findOne', () => {
    it('retorna infração por id', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(mockInfraction);
      const result = await service.findOne(1);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['unit'],
      });
      expect(result).toEqual(mockInfraction);
    });
    it('lança NotFound quando não existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
  describe('update', () => {
    it('atualiza dados da infração e salva', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...mockInfraction });
      (repo.save as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        description: 'Nova',
      });
      const dto = { description: 'Nova' } as any;
      const result = await service.update(1, dto);
      expect(repo.findOne).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.description).toBe('Nova');
    });
  });
  describe('remove', () => {
    it('remove após validar existência', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...mockInfraction });
      (repo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
      await service.remove(1);
      expect(repo.findOne).toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(1);
    });
  });
  describe('analyze', () => {
    it('atualiza com campos em português e status ANALYZED', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...mockInfraction });
      (ia.analisarInfracao as jest.Mock).mockResolvedValue({
        descricao_formal: 'Formal PT',
        penalidade_sugerida: 'Advertência',
      });
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.analyze(1);
      expect(result.formalDescription).toBe('Formal PT');
      expect(result.suggestedPenalty).toBe('Advertência');
      expect(result.status).toBe(InfractionStatus.ANALYZED);
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
  describe('generateDocument', () => {
    it('gera PDF quando a infração existe e foi analisada', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        formalDescription: 'Formal',
      });
      (pdf.gerarDocumentoInfracao as jest.Mock).mockResolvedValue(
        Buffer.from('pdf'),
      );
      const result = await service.generateDocument(1);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['unit', 'unit.condominium'],
      });
      expect(pdf.gerarDocumentoInfracao).toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    it('lança NotFound quando infração não existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.generateDocument(999)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('lança NotFound quando formalDescription está ausente', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        formalDescription: undefined,
      });
      await expect(service.generateDocument(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  describe('findForReport', () => {
    const condo = {
      id: 5,
      name: 'Condo Alpha',
      cnpj: '00.000.000/0001-00',
      address: 'Rua A, 1',
    } as any;
    it('retorna condomínio + infrações sem filtros', async () => {
      (condos.findOne as jest.Mock).mockResolvedValue(condo);
      qb.getMany.mockResolvedValue([mockInfraction]);
      const result = await service.findForReport(5);
      expect(condos.findOne).toHaveBeenCalledWith(5);
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith(
        'infraction.occurrenceDate',
        'ASC',
      );
      expect(result.condominium).toEqual(condo);
      expect(result.infractions).toEqual([mockInfraction]);
    });
    it('aplica filtros from e to', async () => {
      (condos.findOne as jest.Mock).mockResolvedValue(condo);
      qb.getMany.mockResolvedValue([]);
      await service.findForReport(5, '2026-01-01', '2026-12-31');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'infraction.occurrenceDate >= :from',
        { from: '2026-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'infraction.occurrenceDate <= :to',
        { to: '2026-12-31' },
      );
    });
    it('lança BadRequest quando from > to', async () => {
      (condos.findOne as jest.Mock).mockResolvedValue(condo);
      await expect(
        service.findForReport(5, '2026-12-31', '2026-01-01'),
      ).rejects.toThrow(BadRequestException);
    });
    it('propaga 404 quando condomínio não existe', async () => {
      (condos.findOne as jest.Mock).mockRejectedValue(new NotFoundException());
      await expect(service.findForReport(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
