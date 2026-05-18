import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import {
  Infraction,
  InfractionStatus,
} from '../infractions/entities/infraction.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let qb: any;

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(10),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Infraction),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('retorna estrutura correta com contagens zeradas', async () => {
    const result = await service.getMetrics(1, false);

    expect(result.totalInfractions).toBe(10);
    expect(result.byStatus).toMatchObject({
      [InfractionStatus.PENDING]: 0,
      [InfractionStatus.ANALYZED]: 0,
      [InfractionStatus.APPROVED]: 0,
      [InfractionStatus.SENT]: 0,
    });
    expect(result.byMonth).toEqual([]);
    expect(result.topUnits).toEqual([]);
    expect(result.approvalRate).toBe(0);
  });

  it('calcula approvalRate corretamente', async () => {
    qb.getCount.mockResolvedValue(4);
    qb.getRawMany
      .mockResolvedValueOnce([
        { status: InfractionStatus.PENDING, count: '2' },
        { status: InfractionStatus.APPROVED, count: '1' },
        { status: InfractionStatus.SENT, count: '1' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getMetrics(1, false);
    expect(result.approvalRate).toBe(50);
  });

  it('não aplica filtro de companyId quando isMaster=true', async () => {
    await service.getMetrics(99, true);
    expect(qb.where).not.toHaveBeenCalled();
  });
});
