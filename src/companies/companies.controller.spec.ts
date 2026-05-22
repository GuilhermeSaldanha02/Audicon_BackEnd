import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { Actor } from '../audit/audit.service';

const mockMasterActor: Actor = {
  userId: 1,
  email: 'master@audicon.com',
  isMaster: true,
  companyId: null,
};

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    listUsersOfCompany: jest.Mock;
    remove: jest.Mock;
    createEmployee: jest.Mock;
    resetPassword: jest.Mock;
  };
  let condominiumsService: { findByCompany: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      listUsersOfCompany: jest.fn(),
      remove: jest.fn(),
      createEmployee: jest.fn(),
      resetPassword: jest.fn(),
    };
    condominiumsService = { findByCompany: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: service },
        { provide: CondominiumsService, useValue: condominiumsService },
      ],
    }).compile();
    controller = module.get(CompaniesController);
  });

  it('create delega ao service com actor master', async () => {
    const dto: any = {
      name: 'X',
      cnpj: '00.000.000/0001-99',
      admin: { nome: 'A', email: 'a@x.com' },
    };
    service.create.mockResolvedValue({ company: { id: 1 }, admin: {} });
    const result = await controller.create(mockMasterActor, dto);
    expect(service.create).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ isMaster: true }),
    );
    expect(result.company.id).toBe(1);
  });

  it('remove delega ao service com id e actor', async () => {
    service.remove.mockResolvedValue({ id: 2, name: 'Empresa X' });
    const result = await controller.remove(mockMasterActor, 2);
    expect(service.remove).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ isMaster: true }),
    );
    expect(result.id).toBe(2);
  });

  it('createUser delega ao service com companyId, dto e actor', async () => {
    const dto: any = { nome: 'Func', email: 'f@x.com', role: 'EMPLOYEE' };
    service.createEmployee.mockResolvedValue({ id: 10, ...dto });
    const result = await controller.createUser(mockMasterActor, 5, dto);
    expect(service.createEmployee).toHaveBeenCalledWith(
      5,
      dto,
      expect.objectContaining({ isMaster: true }),
    );
    expect(result.id).toBe(10);
  });

  it('resetUserPassword delega ao service com actor.userId como requesterId', async () => {
    service.resetPassword.mockResolvedValue({
      id: 20,
      email: 'f@x.com',
      tempPassword: 'abc123',
    });
    const result = await controller.resetUserPassword(mockMasterActor, 5, 20);
    expect(service.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 5,
        targetUserId: 20,
        requesterId: mockMasterActor.userId,
        enforceNotAdmin: false,
        actor: expect.objectContaining({ isMaster: true }),
      }),
    );
    expect(result.tempPassword).toBe('abc123');
  });

  it('findAll delega ao service', async () => {
    service.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await controller.findAll();
    expect(result).toHaveLength(2);
  });

  it('findOne delega ao service', async () => {
    service.findOne.mockResolvedValue({ id: 5 });
    const result = await controller.findOne(5);
    expect(service.findOne).toHaveBeenCalledWith(5);
    expect(result.id).toBe(5);
  });

  it('listUsers delega ao service com companyId', async () => {
    service.listUsersOfCompany.mockResolvedValue([
      { id: 1, nome: 'A', email: 'a@x.com' },
    ]);
    const result = await controller.listUsers(7);
    expect(service.listUsersOfCompany).toHaveBeenCalledWith(7);
    expect(result).toHaveLength(1);
  });

  it('listCondominiums delega ao condominiumsService com companyId', async () => {
    condominiumsService.findByCompany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await controller.listCondominiums(7);
    expect(condominiumsService.findByCompany).toHaveBeenCalledWith(7);
    expect(result).toHaveLength(2);
  });
});
