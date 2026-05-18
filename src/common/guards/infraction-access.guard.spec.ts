import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InfractionAccessGuard } from './infraction-access.guard';
import { Infraction } from '../../infractions/entities/infraction.entity';

function ctx(user: any, paramId: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { id: paramId } }),
    }),
  };
}

describe('InfractionAccessGuard', () => {
  let guard: InfractionAccessGuard;
  let qb: any;

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfractionAccessGuard,
        {
          provide: getRepositoryToken(Infraction),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
      ],
    }).compile();
    guard = module.get(InfractionAccessGuard);
  });

  it('permite quando companyId do condo bate com user.companyId', async () => {
    qb.getRawOne.mockResolvedValue({ i_id: 1, condo_companyId: 5 });
    const result = await guard.canActivate(
      ctx({ id: 10, companyId: 5, isMaster: false }, '1'),
    );
    expect(result).toBe(true);
  });

  it('rejeita 403 quando empresa diferente', async () => {
    qb.getRawOne.mockResolvedValue({ i_id: 1, condo_companyId: 99 });
    await expect(
      guard.canActivate(ctx({ id: 10, companyId: 5, isMaster: false }, '1')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('master bypassa mesmo em empresa diferente', async () => {
    qb.getRawOne.mockResolvedValue({ i_id: 1, condo_companyId: 99 });
    const result = await guard.canActivate(
      ctx({ id: 1, companyId: null, isMaster: true }, '1'),
    );
    expect(result).toBe(true);
  });

  it('lança NotFound quando infração não existe', async () => {
    qb.getRawOne.mockResolvedValue(null);
    await expect(
      guard.canActivate(ctx({ id: 10, companyId: 5 }, '999')),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança NotFound quando id inválido', async () => {
    await expect(
      guard.canActivate(ctx({ id: 10, companyId: 5 }, 'abc')),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejeita quando user ausente', async () => {
    await expect(guard.canActivate(ctx(undefined, '1'))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
