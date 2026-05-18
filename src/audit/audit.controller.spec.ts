import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('AuditController', () => {
  let controller: AuditController;
  let service: { list: jest.Mock };

  beforeEach(async () => {
    service = {
      list: jest
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuditController);
  });

  it('master sem filtro: list com companyId=null', async () => {
    const req: any = { user: { id: 1, isMaster: true, companyId: null } };
    await controller.list(req, { page: 1, limit: 20 } as any);
    expect(service.list).toHaveBeenCalledWith({
      companyId: null,
      page: 1,
      limit: 20,
    });
  });

  it('master com filtro: usa companyId da query', async () => {
    const req: any = { user: { id: 1, isMaster: true, companyId: null } };
    await controller.list(req, { page: 1, limit: 20, companyId: 5 } as any);
    expect(service.list).toHaveBeenCalledWith({
      companyId: 5,
      page: 1,
      limit: 20,
    });
  });

  it('não-master: força filtro pela própria empresa (ignora query)', async () => {
    const req: any = { user: { id: 1, isMaster: false, companyId: 3 } };
    await controller.list(req, { page: 1, limit: 20, companyId: 99 } as any);
    expect(service.list).toHaveBeenCalledWith({
      companyId: 3,
      page: 1,
      limit: 20,
    });
  });

  it('não-master sem companyId: 403', async () => {
    const req: any = { user: { id: 1, isMaster: false, companyId: null } };
    await expect(
      controller.list(req, { page: 1, limit: 20 } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
