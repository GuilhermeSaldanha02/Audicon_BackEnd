import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infraction } from '../../infractions/entities/infraction.entity';

@Injectable()
export class InfractionAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Não autenticado.');
    }
    const rawId = request.params?.id;
    const infractionId = Number(rawId);
    if (!Number.isInteger(infractionId) || infractionId <= 0) {
      throw new NotFoundException(`Infraction with ID #${rawId} not found.`);
    }

    const row = await this.infractionsRepository
      .createQueryBuilder('i')
      .leftJoin('i.unit', 'unit')
      .leftJoin('unit.condominium', 'condo')
      .select(['i.id', 'condo.companyId'])
      .where('i.id = :id', { id: infractionId })
      .getRawOne<{ i_id: number; condo_companyId: number }>();

    if (!row) {
      throw new NotFoundException(
        `Infraction with ID #${infractionId} not found.`,
      );
    }

    // Master tem bypass total para leitura e operações (auditado em log futuro)
    if (user.isMaster) {
      return true;
    }

    if (row.condo_companyId !== user.companyId) {
      throw new ForbiddenException('Esta infração pertence a outra empresa.');
    }
    return true;
  }
}
