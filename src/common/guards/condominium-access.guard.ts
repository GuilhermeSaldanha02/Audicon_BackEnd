import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Condominium } from '../../condominiums/entities/condominium.entity';

/**
 * Guard de tenant para rotas que operam sobre um condomínio específico.
 *
 * Resolve o condomínio pelo parâmetro de rota (`:condominiumId` quando rota
 * aninhada, ou `:id` quando rota direta de condomínio) e compara
 * `condominium.companyId` com `req.user.companyId`. Master bypassa.
 *
 * Espelha `InfractionAccessGuard` (que já cobre /infractions/:id/*).
 * Aplicado em condominiums.controller, units.controller e reports.controller.
 */
@Injectable()
export class CondominiumAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Condominium)
    private readonly condosRepo: Repository<Condominium>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Não autenticado.');
    }

    const raw = req.params?.condominiumId ?? req.params?.id;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException(`Condominium with ID #${raw} not found.`);
    }

    const row = await this.condosRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.companyId'])
      .where('c.id = :id', { id })
      .getRawOne<{ c_id: number; c_companyId: number }>();

    if (!row) {
      throw new NotFoundException(`Condominium with ID #${id} not found.`);
    }

    if (user.isMaster) {
      return true;
    }

    if (row.c_companyId !== user.companyId) {
      throw new ForbiddenException('Este condomínio pertence a outra empresa.');
    }
    return true;
  }
}
