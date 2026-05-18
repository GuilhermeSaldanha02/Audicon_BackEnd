import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: any;
  let qb: any;

  beforeEach(async () => {
    qb = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  describe('logAsync', () => {
    it('persiste audit com snapshot do actor', async () => {
      repo.save.mockResolvedValue({ id: 1 });
      const result = await service.logAsync({
        actor: {
          userId: 5,
          email: 'a@x.com',
          isMaster: false,
          companyId: 3,
        },
        action: 'INFRACTION_CREATED',
        entity: 'infraction',
        entityId: 42,
        context: { ok: true },
      });
      expect(result).toEqual({ id: 1 });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          userEmail: 'a@x.com',
          userIsMaster: false,
          companyId: 3,
          action: 'INFRACTION_CREATED',
          entity: 'infraction',
          entityId: 42,
          context: { ok: true },
        }),
      );
    });

    it('usa companyIdOverride quando fornecido', async () => {
      repo.save.mockResolvedValue({ id: 2 });
      await service.logAsync({
        actor: { userId: 1, email: 'm@x.com', isMaster: true, companyId: null },
        action: 'COMPANY_CREATED',
        entity: 'company',
        entityId: 99,
        companyIdOverride: 99,
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 99 }),
      );
    });

    it('retorna null em vez de lançar quando save falha', async () => {
      repo.save.mockRejectedValue(new Error('db down'));
      const result = await service.logAsync({
        actor: { userId: 1, email: 'x@x.com', companyId: 1 },
        action: 'INFRACTION_DELETED',
        entity: 'infraction',
        entityId: 1,
      });
      expect(result).toBeNull();
    });
  });

  describe('log (fire-and-forget)', () => {
    it('não lança quando repo falha', () => {
      repo.save.mockRejectedValue(new Error('db down'));
      expect(() =>
        service.log({
          actor: { userId: 1, email: 'x@x.com', companyId: 1 },
          action: 'INFRACTION_DELETED',
          entity: 'infraction',
        }),
      ).not.toThrow();
    });
  });

  describe('list', () => {
    it('aplica filtro de companyId quando fornecido', async () => {
      qb.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      const result = await service.list({ companyId: 3, page: 1, limit: 20 });
      expect(qb.where).toHaveBeenCalledWith('a.companyId = :companyId', {
        companyId: 3,
      });
      expect(result).toEqual({
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('sem filtro retorna todos (master sem companyId)', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.list({ companyId: null, page: 1, limit: 20 });
      expect(qb.where).not.toHaveBeenCalled();
    });
  });
});
