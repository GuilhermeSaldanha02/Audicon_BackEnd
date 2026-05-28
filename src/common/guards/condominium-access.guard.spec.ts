import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CondominiumAccessGuard } from './condominium-access.guard';

function makeCtx(params: Record<string, any>, user: any) {
  const req = { params, user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('CondominiumAccessGuard', () => {
  let repo: any;
  let guard: CondominiumAccessGuard;

  beforeEach(() => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };
    repo = { createQueryBuilder: jest.fn().mockReturnValue(qb), __qb: qb };
    guard = new CondominiumAccessGuard(repo);
  });

  it('permite quando user pertence à mesma empresa do condomínio', async () => {
    repo.__qb.getRawOne.mockResolvedValue({ c_id: 42, c_companyId: 1 });
    const ctx = makeCtx({ id: 42 }, { id: 5, companyId: 1, isMaster: false });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('nega com 403 quando user pertence a outra empresa', async () => {
    repo.__qb.getRawOne.mockResolvedValue({ c_id: 42, c_companyId: 2 });
    const ctx = makeCtx({ id: 42 }, { id: 5, companyId: 1, isMaster: false });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('master bypassa mesmo com companyId nulo', async () => {
    repo.__qb.getRawOne.mockResolvedValue({ c_id: 42, c_companyId: 99 });
    const ctx = makeCtx({ id: 42 }, { id: 1, companyId: null, isMaster: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('lança 404 quando condomínio não existe', async () => {
    repo.__qb.getRawOne.mockResolvedValue(undefined);
    const ctx = makeCtx({ id: 999 }, { id: 5, companyId: 1, isMaster: false });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolve por params.condominiumId quando rota é aninhada (units/reports)', async () => {
    repo.__qb.getRawOne.mockResolvedValue({ c_id: 7, c_companyId: 1 });
    const ctx = makeCtx(
      { condominiumId: 7 },
      { id: 5, companyId: 1, isMaster: false },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(repo.__qb.where).toHaveBeenCalledWith('c.id = :id', { id: 7 });
  });

  it('lança 404 com id inválido (não numérico)', async () => {
    const ctx = makeCtx(
      { id: 'abc' },
      { id: 5, companyId: 1, isMaster: false },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('nega quando não há user no request', async () => {
    const ctx = makeCtx({ id: 1 }, undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
