import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { IaService } from 'src/ia/ia.service';

@Injectable()
export class InfractionAnalysisService {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
    private readonly iaService: IaService,
  ) {}

  async countByUnit(
    unitId: number,
    excludeId?: number,
  ): Promise<{ total: number; last12months: number }> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const base = this.infractionsRepository
      .createQueryBuilder('i')
      .leftJoin('i.unit', 'unit')
      .where('unit.id = :unitId', { unitId });
    if (excludeId) {
      base.andWhere('i.id != :excludeId', { excludeId });
    }

    const total = await base.getCount();
    const last12months = await base
      .clone()
      .andWhere('i.occurrenceDate >= :since', { since: twelveMonthsAgo })
      .getCount();

    return { total, last12months };
  }

  async analyze(id: number) {
    const infraction = await this.infractionsRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.condominium'],
    });
    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }

    let regimentoText: string | undefined;
    const condominiumId = infraction.unit?.condominium?.id;
    if (condominiumId) {
      regimentoText = await this.iaService
        .extractRegimentoText(condominiumId)
        .catch(() => undefined);
    }

    const reincidencias = infraction.unit?.id
      ? await this.countByUnit(infraction.unit.id, infraction.id)
      : undefined;

    const aiResult = await this.iaService.analisarInfracao(
      infraction,
      regimentoText,
      reincidencias,
    );
    infraction.formalDescription =
      (aiResult as any).descricao_formal ?? (aiResult as any).formalDescription;
    infraction.suggestedPenalty =
      (aiResult as any).penalidade_sugerida ??
      (aiResult as any).suggestedPenalty;
    infraction.status = InfractionStatus.ANALYZED;
    return this.infractionsRepository.save(infraction);
  }
}
