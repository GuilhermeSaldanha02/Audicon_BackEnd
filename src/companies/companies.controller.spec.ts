import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompaniesService, useValue: service }],
    }).compile();
    controller = module.get(CompaniesController);
  });

  it('create delega ao service com actor master', async () => {
    const dto: any = {
      name: 'X',
      cnpj: '00.000.000/0001-99',
      admin: { nome: 'A', email: 'a@x.com' },
    };
    const req: any = {
      user: {
        id: 1,
        email: 'master@audicon.com',
        isMaster: true,
        companyId: null,
      },
    };
    service.create.mockResolvedValue({ company: { id: 1 }, admin: {} });
    const result = await controller.create(req, dto);
    expect(service.create).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ isMaster: true }),
    );
    expect(result.company.id).toBe(1);
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
});
