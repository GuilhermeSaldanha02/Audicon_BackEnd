import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCondominium } from '../../users/entities/user-condominium.entity';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class CompanyAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(UserCondominium)
    private readonly ucRepository: Repository<UserCondominium>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.companyId) {
      throw new ForbiddenException(
        'Esta operação requer usuário vinculado a uma empresa.',
      );
    }
    const hasAdminMembership = await this.ucRepository
      .createQueryBuilder('uc')
      .leftJoin('uc.condominium', 'condo')
      .where('uc.userId = :userId', { userId: user.id })
      .andWhere('uc.role = :role', { role: UserRole.ADMIN })
      .andWhere('condo.companyId = :companyId', { companyId: user.companyId })
      .getCount();
    if (hasAdminMembership === 0) {
      throw new ForbiddenException(
        'Apenas usuários ADMIN de pelo menos um condomínio da empresa podem realizar esta operação.',
      );
    }
    return true;
  }
}
