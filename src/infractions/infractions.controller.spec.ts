import { Test, TestingModule } from '@nestjs/testing';
import { InfractionsController } from './infractions.controller';
import { InfractionsService } from './infractions.service';
describe('InfractionsController', () => {
    let controller: InfractionsController;
    let service: {
        create: jest.Mock;
        findAll: jest.Mock;
        findOne: jest.Mock;
        analyze: jest.Mock;
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
        }).compile();
        controller = module.get<InfractionsController>(InfractionsController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    it('create chama service.create com dto', async () => {
        const dto: any = { description: 'Teste', unitId: 10 };
        service.create.mockResolvedValue({ id: 1, ...dto });
        const result = await controller.create(dto);
        expect(service.create).toHaveBeenCalledWith(dto);
        expect(result).toEqual({ id: 1, ...dto });
    });
    it('findAll sem unitId', async () => {
        service.findAll.mockResolvedValue([{ id: 1 }]);
        const result = await controller.findAll(undefined);
        expect(service.findAll).toHaveBeenCalledWith(undefined);
        expect(result).toEqual([{ id: 1 }]);
    });
    it('findAll com unitId', async () => {
        service.findAll.mockResolvedValue([{ id: 2 }]);
        const result = await controller.findAll(10);
        expect(service.findAll).toHaveBeenCalledWith(10);
        expect(result).toEqual([{ id: 2 }]);
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
    it('update chama service.update com id e dto', async () => {
        const dto: any = { description: 'Atualizado' };
        service.update.mockResolvedValue({ id: 6, ...dto });
        const result = await controller.update(6, dto);
        expect(service.update).toHaveBeenCalledWith(6, dto);
        expect(result).toEqual({ id: 6, ...dto });
    });
    it('remove chama service.remove com id', async () => {
        service.remove.mockResolvedValue(undefined);
        const result = await controller.remove(7);
        expect(service.remove).toHaveBeenCalledWith(7);
        expect(result).toBeUndefined();
    });
});
