import { Test, TestingModule } from '@nestjs/testing';
import { InfractionNotificationService } from './infraction-notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { InfractionSeverity } from './enums/infraction-severity.enum';
import { PdfService } from '../pdf/pdf.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ImagesService } from './images.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InfractionNotificationService', () => {
  let service: InfractionNotificationService;
  let repo: any;
  let pdf: any;
  let mail: any;
  let whatsapp: any;
  let qb: any;

  const mockInfraction: Infraction = {
    id: 1,
    description: 'Desc',
    severity: InfractionSeverity.MEDIA,
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
        InfractionNotificationService,
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
          provide: PdfService,
          useValue: {
            gerarDocumentoInfracao: jest.fn(),
            streamInfractionReport: jest.fn(),
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

    service = module.get<InfractionNotificationService>(
      InfractionNotificationService,
    );
    repo = module.get(getRepositoryToken(Infraction));
    pdf = module.get(PdfService);
    mail = module.get(MailService);
    whatsapp = module.get(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
});
