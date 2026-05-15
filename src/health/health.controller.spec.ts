import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheck: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };

  beforeEach(async () => {
    healthCheck = { check: jest.fn() };
    db = { pingCheck: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheck },
        { provide: TypeOrmHealthIndicator, useValue: db },
      ],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  describe('live', () => {
    it('returns status ok without touching DB', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
      expect(healthCheck.check).not.toHaveBeenCalled();
      expect(db.pingCheck).not.toHaveBeenCalled();
    });
  });

  describe('ready', () => {
    it('delegates to HealthCheckService with a DB ping indicator', async () => {
      const fakeResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };
      healthCheck.check.mockResolvedValue(fakeResult);
      db.pingCheck.mockResolvedValue({ database: { status: 'up' } });

      const result = await controller.ready();

      expect(healthCheck.check).toHaveBeenCalledTimes(1);
      const indicators = healthCheck.check.mock.calls[0][0] as Array<
        () => unknown
      >;
      expect(indicators).toHaveLength(1);
      indicators[0]();
      expect(db.pingCheck).toHaveBeenCalledWith('database');
      expect(result).toEqual(fakeResult);
    });
  });
});
