import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '../enums/system-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de papel por empresa (modelo R-02/R-03+04).
 *
 * Lê `User.role` (SystemRole) já hidratado em `req.user` pela JwtStrategy
 * — sem lookup em banco. Master bypassa.
 *
 * Isolamento por empresa é responsabilidade do CondominiumAccessGuard
 * (rotas de condomínio/unidade) e do InfractionAccessGuard (rotas de
 * infração). Ver R-05 para centralização futura.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.isMaster) return true;
    return required.includes(user.role);
  }
}
