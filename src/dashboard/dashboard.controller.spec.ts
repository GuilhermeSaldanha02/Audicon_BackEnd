import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { getMetrics: jest.Mock };

  const mockResult = {
    totalInfractions: 5,
    byStatus: { pending: 2, analyzed: 1, approved: 1, sent: 1 },
    byMonth: [],
    topUnits: [],
    approvalRate: 40,
  };

  beforeEach(async () => {
    service = { getMetrics: jest.fn().mockResolvedValue(mockResult) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('chama getMetrics com companyId e isMaster do token', async () => {
    const req = { user: { companyId: 1, isMaster: false } };
    const result = await controller.getMetrics(req);

    expect(service.getMetrics).toHaveBeenCalledWith(1, false);
    expect(result).toBe(mockResult);
  });

  it('passa isMaster=true para master', async () => {
    const req = { user: { companyId: null, isMaster: true } };
    await controller.getMetrics(req);
    expect(service.getMetrics).toHaveBeenCalledWith(null, true);
  });
});
