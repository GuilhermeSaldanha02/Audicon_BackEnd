import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsController } from './condominiums.controller';
import { CondominiumsService } from './condominiums.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { CondominiumAccessGuard } from '../common/guards/condominium-access.guard';
import { Actor } from '../audit/audit.service';

const mockActor: Actor = {
  userId: 42,
  email: 'admin@x.com',
  companyId: 1,
  isMaster: false,
};

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
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MasterGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CondominiumAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CondominiumsController>(CondominiumsController);
    service = module.get(
      CondominiumsService,
    ) as jest.Mocked<CondominiumsService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create deve delegar para o service com dto e actor', async () => {
    const dto: any = {
      name: 'Condo A',
      cnpj: '00.000.000/0000-00',
      address: 'Rua 1',
      companyId: 1,
    };
    const created = { id: 1, ...dto } as any;
    service.create.mockResolvedValue(created);
    const result = await controller.create(mockActor, dto);
    expect(result).toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto, expect.any(Object));
  });

  it('findAll deve delegar para o service com paginação e companyId', async () => {
    const pagination = { page: 1, limit: 20 };
    const paginated = {
      data: [{ id: 1 }],
      total: 1,
      page: 1,
      limit: 20,
    } as any;
    service.findAll.mockResolvedValue(paginated);
    const result = await controller.findAll(mockActor, pagination);
    expect(result).toEqual(paginated);
    expect(service.findAll).toHaveBeenCalledWith(pagination, mockActor);
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
    const result = await controller.remove(mockActor, id);
    expect(result).toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(id, expect.any(Object));
  });
});
