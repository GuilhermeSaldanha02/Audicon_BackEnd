import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { SystemRole } from '../enums/system-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

function makeCtx(user: any) {
  const req = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => function Klass() {},
  } as any;
}

describe('RolesGuard (SystemRole)', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function setRequired(roles: SystemRole[] | undefined) {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) =>
        key === ROLES_KEY ? (roles as any) : undefined,
      );
  }

  it('permite quando rota não declara @Roles', () => {
    setRequired(undefined);
    expect(guard.canActivate(makeCtx({ role: SystemRole.FUNCIONARIO }))).toBe(
      true,
    );
  });

  it('permite quando @Roles é lista vazia', () => {
    setRequired([]);
    expect(guard.canActivate(makeCtx({ role: SystemRole.FUNCIONARIO }))).toBe(
      true,
    );
  });

  it('master bypassa mesmo sem o papel exigido', () => {
    setRequired([SystemRole.GERENTE]);
    expect(
      guard.canActivate(makeCtx({ isMaster: true, role: SystemRole.MASTER })),
    ).toBe(true);
  });

  it('permite quando o papel do user está em requiredRoles', () => {
    setRequired([SystemRole.GERENTE, SystemRole.FUNCIONARIO]);
    expect(guard.canActivate(makeCtx({ role: SystemRole.FUNCIONARIO }))).toBe(
      true,
    );
  });

  it('nega quando o papel do user NÃO está em requiredRoles', () => {
    setRequired([SystemRole.GERENTE]);
    expect(guard.canActivate(makeCtx({ role: SystemRole.FUNCIONARIO }))).toBe(
      false,
    );
  });

  it('nega quando não há user no request', () => {
    setRequired([SystemRole.GERENTE]);
    expect(guard.canActivate(makeCtx(undefined))).toBe(false);
  });
});
