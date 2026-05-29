import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsService } from './infractions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { UnitsService } from '../units/units.service';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
describe('InfractionsService', () => {
  let service: InfractionsService;
  let repo: any;
  let units: any;
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
            softDelete: jest.fn(),
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
          provide: CondominiumsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
            logAsync: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();
    service = module.get<InfractionsService>(InfractionsService);
    repo = module.get(getRepositoryToken(Infraction));
    units = module.get(UnitsService);
    condos = module.get(CondominiumsService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('create', () => {
    it('cria infração quando master (bypassa validação de empresa)', async () => {
      const dto = { description: 'Teste', unitId: 10 } as any;
      (units.findOne as jest.Mock).mockResolvedValue(mockInfraction.unit);
      (repo.create as jest.Mock).mockReturnValue({
        ...mockInfraction,
        id: undefined,
      });
      (repo.save as jest.Mock).mockResolvedValue({ ...mockInfraction });
      const result = await service.create(dto, null, true);
      expect(result).toEqual(mockInfraction);
    });
    it('cria infração quando unidade pertence à mesma empresa do solicitante', async () => {
      const dto = { description: 'Teste', unitId: 10 } as any;
      (units.findOne as jest.Mock).mockResolvedValue(mockInfraction.unit);
      (condos.findOne as jest.Mock).mockResolvedValue({ id: 5, companyId: 1 });
      (repo.create as jest.Mock).mockReturnValue({ ...mockInfraction });
      (repo.save as jest.Mock).mockResolvedValue({ ...mockInfraction });
      const result = await service.create(dto, 1, false);
      expect(result).toEqual(mockInfraction);
    });
    it('rejeita quando unidade pertence a outra empresa', async () => {
      const dto = { description: 'Teste', unitId: 10 } as any;
      (units.findOne as jest.Mock).mockResolvedValue(mockInfraction.unit);
      (condos.findOne as jest.Mock).mockResolvedValue({ id: 5, companyId: 2 });
      await expect(service.create(dto, 1, false)).rejects.toThrow(
        /outra empresa/,
      );
    });
  });
  describe('findAll', () => {
    const pagination = { page: 1, limit: 20 };
    const master: any = { companyId: null, isMaster: true };
    const userA: any = { companyId: 1, isMaster: false };

    it('master retorna resultado paginado sem filtro de empresa', async () => {
      qb.getManyAndCount.mockResolvedValue([[mockInfraction], 1]);
      const result = await service.findAll(pagination, undefined, master);
      expect(result).toEqual({
        data: [mockInfraction],
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(qb.where).not.toHaveBeenCalled();
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('non-master aplica filtro de companyId', async () => {
      qb.getManyAndCount.mockResolvedValue([[mockInfraction], 1]);
      await service.findAll(pagination, undefined, userA);
      expect(qb.andWhere).toHaveBeenCalledWith('condo.companyId = :companyId', {
        companyId: 1,
      });
    });

    it('filtra por unidade quando unitId fornecido', async () => {
      (units.findOne as jest.Mock).mockResolvedValue(mockInfraction.unit);
      qb.getManyAndCount.mockResolvedValue([[mockInfraction], 1]);
      const result = await service.findAll(pagination, 10, master);
      expect(units.findOne).toHaveBeenCalledWith(10);
      expect(qb.where).toHaveBeenCalledWith('unit.id = :unitId', {
        unitId: 10,
      });
      expect(result.data).toEqual([mockInfraction]);
    });

    it('lança NotFoundException quando unitId não existe', async () => {
      (units.findOne as jest.Mock).mockRejectedValue(new NotFoundException());
      await expect(
        service.findAll(pagination, 999, master),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('aplica skip e take corretos para page 2', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 2, limit: 10 }, undefined, master);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('non-master sem companyId → 403 (defesa do helper)', async () => {
      await expect(
        service.findAll(pagination, undefined, {
          companyId: null,
          isMaster: false,
        }),
      ).rejects.toThrow(/empresa/i);
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
  describe('exportCsv', () => {
    const userA: any = { companyId: 1, isMaster: false };

    it('retorna header + linha por infração', async () => {
      (qb.getMany as jest.Mock).mockResolvedValue([mockInfraction]);
      const csv = await service.exportCsv({}, userA);
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'id,unidade,condominio,status,descricao,data_ocorrencia,aprovado_em,enviado_em',
      );
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('pending');
    });

    it('retorna só o header quando não há registros', async () => {
      (qb.getMany as jest.Mock).mockResolvedValue([]);
      const csv = await service.exportCsv({}, userA);
      expect(csv).toBe(
        'id,unidade,condominio,status,descricao,data_ocorrencia,aprovado_em,enviado_em',
      );
    });

    it('non-master sem companyId → 403 (defesa do helper)', async () => {
      await expect(
        service.exportCsv({}, { companyId: null, isMaster: false }),
      ).rejects.toThrow(/empresa/i);
    });
  });

  describe('remove', () => {
    it('soft-deleta após validar existência', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...mockInfraction });
      (repo.softDelete as jest.Mock).mockResolvedValue({ affected: 1 });
      await service.remove(1);
      expect(repo.findOne).toHaveBeenCalled();
      expect(repo.softDelete).toHaveBeenCalledWith(1);
    });
  });
  describe('approve', () => {
    it('aprova infração no status ANALYZED', async () => {
      const analyzed = {
        ...mockInfraction,
        status: InfractionStatus.ANALYZED,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(analyzed);
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.approve(1);
      expect(result.status).toBe(InfractionStatus.APPROVED);
      expect(result.approvedAt).toBeInstanceOf(Date);
    });
    it('permite override de formalDescription e suggestedPenalty', async () => {
      const analyzed = {
        ...mockInfraction,
        status: InfractionStatus.ANALYZED,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(analyzed);
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.approve(1, {
        formalDescription: 'Texto revisado',
        suggestedPenalty: 'Multa',
      });
      expect(result.formalDescription).toBe('Texto revisado');
      expect(result.suggestedPenalty).toBe('Multa');
      expect(result.status).toBe(InfractionStatus.APPROVED);
    });
    it('rejeita quando status é PENDING', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.PENDING,
      });
      await expect(service.approve(1)).rejects.toThrow(BadRequestException);
    });
    it('rejeita quando status já é APPROVED', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.APPROVED,
      });
      await expect(service.approve(1)).rejects.toThrow(BadRequestException);
    });
    it('rejeita quando status é SENT', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.SENT,
      });
      await expect(service.approve(1)).rejects.toThrow(BadRequestException);
    });
    it('propaga NotFound quando infração não existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.approve(999)).rejects.toThrow(NotFoundException);
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
