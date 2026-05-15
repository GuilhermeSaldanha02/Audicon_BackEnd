import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsController } from './condominiums.controller';
import { CondominiumsService } from './condominiums.service';
import { RolesGuard } from '../common/guards/roles.guard';

const mockReq = { user: { id: 42 } };

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
            addMember: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(RolesGuard)
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

  it('create deve delegar para o service com dto e userId', async () => {
    const dto: any = {
      name: 'Condo A',
      cnpj: '00.000.000/0000-00',
      address: 'Rua 1',
    };
    const created = { id: 1, ...dto } as any;
    service.create.mockResolvedValue(created);
    const result = await controller.create(mockReq, dto);
    expect(result).toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto, mockReq.user.id);
  });

  it('findAll deve delegar para o service com userId', async () => {
    const list = [{ id: 1 }, { id: 2 }] as any[];
    service.findAll.mockResolvedValue(list as any);
    const result = await controller.findAll(mockReq);
    expect(result).toEqual(list);
    expect(service.findAll).toHaveBeenCalledWith(mockReq.user.id);
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

  it('addMember deve delegar para o service', async () => {
    const dto: any = { email: 'novo@condo.com', role: 'MANAGER' };
    const membership = {
      id: 1,
      condominiumId: 3,
      userId: 5,
      role: 'MANAGER',
    } as any;
    service.addMember.mockResolvedValue(membership);
    const result = await controller.addMember(3, dto);
    expect(result).toEqual(membership);
    expect(service.addMember).toHaveBeenCalledWith(3, dto);
  });
});
