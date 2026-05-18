import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { CompaniesService } from './companies.service';
import { CompanyAdminGuard } from '../common/guards/company-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  let service: { createEmployee: jest.Mock; listEmployees: jest.Mock };

  beforeEach(async () => {
    service = {
      createEmployee: jest.fn(),
      listEmployees: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: CompaniesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CompanyAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(EmployeesController);
  });

  it('create delega companyId + dto + actor', async () => {
    const req: any = {
      user: { id: 1, email: 'admin@x.com', companyId: 3, isMaster: false },
    };
    const dto: any = { nome: 'F1', email: 'f1@x.com' };
    service.createEmployee.mockResolvedValue({
      id: 10,
      nome: 'F1',
      email: 'f1@x.com',
      tempPassword: 'abc',
    });
    const result = await controller.create(req, dto);
    expect(service.createEmployee).toHaveBeenCalledWith(
      3,
      dto,
      expect.objectContaining({ userId: 1, companyId: 3 }),
    );
    expect(result.tempPassword).toBe('abc');
  });

  it('list delega companyId', async () => {
    const req: any = { user: { id: 1, companyId: 3 } };
    service.listEmployees.mockResolvedValue([{ id: 5 }]);
    const result = await controller.list(req);
    expect(service.listEmployees).toHaveBeenCalledWith(3);
    expect(result).toHaveLength(1);
  });
});
