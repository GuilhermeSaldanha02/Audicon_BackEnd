import { ForbiddenException } from '@nestjs/common';
import { MasterGuard } from './master.guard';

function ctx(user: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

describe('MasterGuard', () => {
  const guard = new MasterGuard();

  it('permite quando user.isMaster === true', () => {
    expect(guard.canActivate(ctx({ id: 1, isMaster: true }))).toBe(true);
  });

  it('rejeita quando user.isMaster === false', () => {
    expect(() => guard.canActivate(ctx({ id: 1, isMaster: false }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejeita quando user é undefined', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('rejeita quando isMaster ausente', () => {
    expect(() => guard.canActivate(ctx({ id: 1 }))).toThrow(ForbiddenException);
  });
});
