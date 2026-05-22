import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsController } from './infractions.controller';
import { InfractionsService } from './infractions.service';
import { InfractionAccessGuard } from '../common/guards/infraction-access.guard';
import { Actor } from '../audit/audit.service';
describe('InfractionsController', () => {
  let controller: InfractionsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    analyze: jest.Mock;
    approve: jest.Mock;
    send: jest.Mock;
    sendWhatsapp: jest.Mock;
    generateDocument: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      analyze: jest.fn(),
      approve: jest.fn(),
      send: jest.fn(),
      sendWhatsapp: jest.fn(),
      generateDocument: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfractionsController],
      providers: [
        {
          provide: InfractionsService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(InfractionAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<InfractionsController>(InfractionsController);
  });
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  const mockActor: Actor = {
    userId: 1,
    email: 'u@x.com',
    companyId: 1,
    isMaster: false,
  };
  it('create chama service.create com dto + companyId + isMaster + actor', async () => {
    const dto: any = { description: 'Teste', unitId: 10 };
    service.create.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.create(mockActor, dto);
    expect(service.create).toHaveBeenCalledWith(
      dto,
      1,
      false,
      expect.any(Object),
    );
    expect(result).toEqual({ id: 1, ...dto });
  });
  it('findAll sem unitId repassa paginação + companyId', async () => {
    const query: any = { page: 1, limit: 20 };
    const paginated = { data: [{ id: 1 }], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll(mockActor, query);
    expect(service.findAll).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      undefined,
      1,
      false,
    );
    expect(result).toEqual(paginated);
  });
  it('findAll com unitId desestrutura e repassa ao service', async () => {
    const query: any = { page: 1, limit: 20, unitId: 10 };
    const paginated = { data: [{ id: 2 }], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll(mockActor, query);
    expect(service.findAll).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      10,
      1,
      false,
    );
    expect(result).toEqual(paginated);
  });
  it('findOne chama service.findOne', async () => {
    service.findOne.mockResolvedValue({ id: 3 });
    const result = await controller.findOne(3);
    expect(service.findOne).toHaveBeenCalledWith(3);
    expect(result).toEqual({ id: 3 });
  });
  it('analyze chama service.analyze', async () => {
    service.analyze.mockResolvedValue({ id: 4, status: 'analyzed' });
    const result = await controller.analyze(4);
    expect(service.analyze).toHaveBeenCalledWith(4);
    expect(result).toEqual({ id: 4, status: 'analyzed' });
  });
  it('generateDocument escreve headers e finaliza response com PDF', async () => {
    const buffer = Buffer.from('pdfdata');
    service.generateDocument.mockResolvedValue(buffer);
    const res: any = { set: jest.fn(), end: jest.fn() };
    await controller.generateDocument(5, res);
    expect(service.generateDocument).toHaveBeenCalledWith(5);
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=infraction-5.pdf',
      'Content-Length': buffer.length,
    });
    expect(res.end).toHaveBeenCalledWith(buffer);
  });
  it('approve chama service.approve com id e dto vazio', async () => {
    service.approve.mockResolvedValue({ id: 8, status: 'approved' });
    const result = await controller.approve(mockActor, 8, {});
    expect(service.approve).toHaveBeenCalledWith(8, {}, expect.any(Object));
    expect(result).toEqual({ id: 8, status: 'approved' });
  });
  it('approve repassa override de campos ao service', async () => {
    const dto = {
      formalDescription: 'Revisado',
      suggestedPenalty: 'Multa',
    };
    service.approve.mockResolvedValue({ id: 9, status: 'approved', ...dto });
    const result = await controller.approve(mockActor, 9, dto);
    expect(service.approve).toHaveBeenCalledWith(9, dto, expect.any(Object));
    expect(result.status).toBe('approved');
  });
  it('sendWhatsapp chama service.sendWhatsapp com id', async () => {
    service.sendWhatsapp.mockResolvedValue({
      id: 11,
      whatsappSentAt: new Date(),
    });
    const result = await controller.sendWhatsapp(mockActor, 11);
    expect(service.sendWhatsapp).toHaveBeenCalledWith(11, expect.any(Object));
    expect(result.id).toBe(11);
  });
  it('send chama service.send com id', async () => {
    service.send.mockResolvedValue({ id: 10, status: 'sent' });
    const result = await controller.send(mockActor, 10);
    expect(service.send).toHaveBeenCalledWith(10, expect.any(Object));
    expect(result).toEqual({ id: 10, status: 'sent' });
  });
  it('update chama service.update com id e dto', async () => {
    const dto: any = { description: 'Atualizado' };
    service.update.mockResolvedValue({ id: 6, ...dto });
    const result = await controller.update(6, dto);
    expect(service.update).toHaveBeenCalledWith(6, dto);
    expect(result).toEqual({ id: 6, ...dto });
  });
  it('remove chama service.remove com id', async () => {
    service.remove.mockResolvedValue(undefined);
    const result = await controller.remove(mockActor, 7);
    expect(service.remove).toHaveBeenCalledWith(7, expect.any(Object));
    expect(result).toBeUndefined();
  });
});
