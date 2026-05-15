import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCondominium } from '../../users/entities/user-condominium.entity';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const rawId = request.params?.condominiumId ?? request.params?.id;
    const condominiumId = rawId ? +rawId : NaN;
    if (isNaN(condominiumId)) return false;

    const membership = await this.ucRepo.findOne({
      where: { userId: user.id, condominiumId },
    });

    if (!membership) return false;
    return requiredRoles.includes(membership.role);
  }
}
