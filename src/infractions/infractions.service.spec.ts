import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsService } from './infractions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { UnitsService } from '../units/units.service';
import { IaService } from '../ia/ia.service';
import { PdfService } from '../pdf/pdf.service';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ImagesService } from './images.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
describe('InfractionsService', () => {
  let service: InfractionsService;
  let repo: any;
  let units: any;
  let ia: any;
  let pdf: any;
  let mail: any;
  let whatsapp: any;
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
            extractRegimentoText: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: MailService,
          useValue: {
            sendInfractionEmail: jest.fn().mockResolvedValue({ id: 'mock-1' }),
          },
        },
        {
          provide: WhatsappService,
          useValue: {
            sendInfractionAlert: jest
              .fn()
              .mockResolvedValue({ id: 'wa-mock-1' }),
          },
        },
        {
          provide: ImagesService,
          useValue: {
            getContentBuffers: jest.fn().mockResolvedValue([]),
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
    ia = module.get(IaService);
    pdf = module.get(PdfService);
    condos = module.get(CondominiumsService);
    mail = module.get(MailService);
    whatsapp = module.get(WhatsappService);
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
  describe('send', () => {
    const approved = {
      ...mockInfraction,
      status: InfractionStatus.APPROVED,
      formalDescription: 'Descrição formal aprovada',
    };
    it('envia e-mail e transiciona para SENT', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...approved });
      (pdf.gerarDocumentoInfracao as jest.Mock).mockResolvedValue(
        Buffer.from('pdf-bytes'),
      );
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.send(1);
      expect(mail.sendInfractionEmail).toHaveBeenCalledWith({
        infraction: expect.objectContaining({ id: 1 }),
        to: 'morador@teste.com',
        pdfBuffer: expect.any(Buffer),
      });
      expect(result.status).toBe(InfractionStatus.SENT);
      expect(result.sentAt).toBeInstanceOf(Date);
    });
    it('rejeita quando status é PENDING', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.PENDING,
      });
      await expect(service.send(1)).rejects.toThrow(BadRequestException);
      expect(mail.sendInfractionEmail).not.toHaveBeenCalled();
    });
    it('rejeita quando status é ANALYZED', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.ANALYZED,
      });
      await expect(service.send(1)).rejects.toThrow(BadRequestException);
    });
    it('rejeita quando status já é SENT', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.SENT,
      });
      await expect(service.send(1)).rejects.toThrow(BadRequestException);
    });
    it('rejeita quando unidade não tem residentEmail', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...approved,
        unit: { ...approved.unit, residentEmail: null },
      });
      await expect(service.send(1)).rejects.toThrow(BadRequestException);
      expect(mail.sendInfractionEmail).not.toHaveBeenCalled();
    });
    it('propaga NotFound quando infração não existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.send(999)).rejects.toThrow(NotFoundException);
    });
  });
  describe('sendWhatsapp', () => {
    const approved = {
      ...mockInfraction,
      status: InfractionStatus.APPROVED,
    };
    it('envia WhatsApp e preenche whatsappSentAt no status APPROVED', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ ...approved });
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.sendWhatsapp(1);
      expect(whatsapp.sendInfractionAlert).toHaveBeenCalledWith({
        infraction: expect.objectContaining({ id: 1 }),
        phone: '11999998888',
      });
      expect(result.whatsappSentAt).toBeInstanceOf(Date);
      // status não muda
      expect(result.status).toBe(InfractionStatus.APPROVED);
    });
    it('permite envio também no status SENT (canal complementar ao e-mail)', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...approved,
        status: InfractionStatus.SENT,
      });
      (repo.save as jest.Mock).mockImplementation((inf: any) => inf);
      const result = await service.sendWhatsapp(1);
      expect(result.status).toBe(InfractionStatus.SENT);
      expect(result.whatsappSentAt).toBeInstanceOf(Date);
    });
    it('rejeita quando status é PENDING ou ANALYZED', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockInfraction,
        status: InfractionStatus.ANALYZED,
      });
      await expect(service.sendWhatsapp(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(whatsapp.sendInfractionAlert).not.toHaveBeenCalled();
    });
    it('rejeita quando unidade não tem residentPhone', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...approved,
        unit: { ...approved.unit, residentPhone: null },
      });
      await expect(service.sendWhatsapp(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(whatsapp.sendInfractionAlert).not.toHaveBeenCalled();
    });
    it('propaga NotFound quando infração não existe', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.sendWhatsapp(999)).rejects.toThrow(
        NotFoundException,
      );
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
