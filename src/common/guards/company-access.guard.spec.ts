import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyAccessGuard } from './company-access.guard';

function ctx(user: any, companyId: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { companyId } }),
    }),
  } as any;
}

describe('CompanyAccessGuard', () => {
  const guard = new CompanyAccessGuard();

  it('master bypassa (qualquer empresa)', () => {
    expect(
      guard.canActivate(ctx({ isMaster: true, companyId: null }, '999')),
    ).toBe(true);
  });

  it('gerente na própria empresa → true', () => {
    expect(guard.canActivate(ctx({ isMaster: false, companyId: 5 }, '5'))).toBe(
      true,
    );
  });

  it('gerente em outra empresa → ForbiddenException (403)', () => {
    expect(() =>
      guard.canActivate(ctx({ isMaster: false, companyId: 5 }, '6')),
    ).toThrow(ForbiddenException);
  });

  it('sem user → ForbiddenException', () => {
    expect(() => guard.canActivate(ctx(undefined, '5'))).toThrow(
      ForbiddenException,
    );
  });

  it('companyId inválido → NotFoundException', () => {
    expect(() =>
      guard.canActivate(ctx({ isMaster: false, companyId: 5 }, 'abc')),
    ).toThrow(NotFoundException);
  });
});
