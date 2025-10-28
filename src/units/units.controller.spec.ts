import { Test, TestingModule } from '@nestjs/testing';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
describe('UnitsController', () => {
    let controller: UnitsController;
    let service: jest.Mocked<UnitsService>;
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UnitsController],
            providers: [
                {
                    provide: UnitsService,
                    useValue: {
                        create: jest.fn(),
                        findAll: jest.fn(),
                        findOne: jest.fn(),
                        update: jest.fn(),
                        remove: jest.fn(),
                    },
                },
            ],
        }).compile();
        controller = module.get<UnitsController>(UnitsController);
        service = module.get(UnitsService) as jest.Mocked<UnitsService>;
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    it('create deve delegar para o service com condominiumId e DTO', async () => {
        const condominiumId = 10;
        const dto: any = { identifier: 'A-101', ownerName: 'John' };
        const created = { id: 1, ...dto } as any;
        service.create.mockResolvedValue(created);
        const result = await controller.create(condominiumId, dto);
        expect(result).toEqual(created);
        expect(service.create).toHaveBeenCalledWith(condominiumId, dto);
    });
    it('findAll deve delegar para o service com condominiumId', async () => {
        const condominiumId = 10;
        const list = [{ id: 1 }, { id: 2 }] as any[];
        service.findAll.mockResolvedValue(list as any);
        const result = await controller.findAll(condominiumId);
        expect(result).toEqual(list);
        expect(service.findAll).toHaveBeenCalledWith(condominiumId);
    });
    it('findOne deve delegar para o service com id numérico', async () => {
        const entity = { id: 5 } as any;
        service.findOne.mockResolvedValue(entity);
        const result = await controller.findOne(5);
        expect(result).toEqual(entity);
        expect(service.findOne).toHaveBeenCalledWith(5);
    });
    it('update deve delegar para o service com id e DTO', async () => {
        const id = 7;
        const dto: any = { ownerName: 'Jane' };
        const updated = { id, ownerName: 'Jane' } as any;
        service.update.mockResolvedValue(updated);
        const result = await controller.update(id, dto);
        expect(result).toEqual(updated);
        expect(service.update).toHaveBeenCalledWith(id, dto);
    });
    it('remove deve delegar para o service e retornar undefined', async () => {
        const id = 9;
        service.remove.mockResolvedValue(undefined as any);
        const result = await controller.remove(id);
        expect(result).toBeUndefined();
        expect(service.remove).toHaveBeenCalledWith(id);
    });
});
