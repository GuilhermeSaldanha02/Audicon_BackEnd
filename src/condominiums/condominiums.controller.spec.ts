import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsController } from './condominiums.controller';
import { CondominiumsService } from './condominiums.service';
describe('CondominiumsController', () => {
    let controller: CondominiumsController;
    let service: jest.Mocked<CondominiumsService>;
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CondominiumsController],
            providers: [
                {
                    provide: CondominiumsService,
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
        controller = module.get<CondominiumsController>(CondominiumsController);
        service = module.get(CondominiumsService) as jest.Mocked<CondominiumsService>;
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    it('create deve delegar para o service e retornar o resultado', async () => {
        const dto: any = {
            name: 'Condo A',
            cnpj: '00.000.000/0000-00',
            address: 'Rua 1',
        };
        const created = { id: 1, ...dto } as any;
        service.create.mockResolvedValue(created);
        const result = await controller.create(dto);
        expect(result).toEqual(created);
        expect(service.create).toHaveBeenCalledWith(dto);
    });
    it('findAll deve delegar para o service e retornar lista', async () => {
        const list = [{ id: 1 }, { id: 2 }] as any[];
        service.findAll.mockResolvedValue(list as any);
        const result = await controller.findAll();
        expect(result).toEqual(list);
        expect(service.findAll).toHaveBeenCalledTimes(1);
    });
    it('findOne deve delegar para o service com id numérico', async () => {
        const entity = { id: 10 } as any;
        service.findOne.mockResolvedValue(entity);
        const result = await controller.findOne(10);
        expect(result).toEqual(entity);
        expect(service.findOne).toHaveBeenCalledWith(10);
    });
    it('update deve delegar para o service com id e DTO', async () => {
        const id = 5;
        const dto: any = { name: 'Atualizado' };
        const updated = { id, name: 'Atualizado' } as any;
        service.update.mockResolvedValue(updated);
        const result = await controller.update(id, dto);
        expect(result).toEqual(updated);
        expect(service.update).toHaveBeenCalledWith(id, dto);
    });
    it('remove deve delegar para o service e retornar undefined', async () => {
        const id = 7;
        service.remove.mockResolvedValue(undefined as any);
        const result = await controller.remove(id);
        expect(result).toBeUndefined();
        expect(service.remove).toHaveBeenCalledWith(id);
    });
});
