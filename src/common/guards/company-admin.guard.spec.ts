import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { CompanyAdminGuard } from './company-admin.guard';
import { UserCondominium } from '../../users/entities/user-condominium.entity';

function ctx(user: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

describe('CompanyAdminGuard', () => {
  let guard: CompanyAdminGuard;
  let qb: any;

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyAdminGuard,
        {
          provide: getRepositoryToken(UserCondominium),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
      ],
    }).compile();
    guard = module.get(CompanyAdminGuard);
  });

  it('permite quando user tem membership ADMIN em condo da própria empresa', async () => {
    qb.getCount.mockResolvedValue(1);
    const result = await guard.canActivate(ctx({ id: 5, companyId: 3 }));
    expect(result).toBe(true);
  });

  it('rejeita quando user não tem nenhum membership ADMIN', async () => {
    qb.getCount.mockResolvedValue(0);
    await expect(
      guard.canActivate(ctx({ id: 5, companyId: 3 })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejeita quando user sem companyId (master)', async () => {
    await expect(
      guard.canActivate(ctx({ id: 1, isMaster: true, companyId: null })),
    ).rejects.toThrow(/empresa/);
  });

  it('rejeita quando user ausente', async () => {
    await expect(guard.canActivate(ctx(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
