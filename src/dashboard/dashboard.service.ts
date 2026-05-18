import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Infraction,
  InfractionStatus,
} from '../infractions/entities/infraction.entity';

export interface DashboardResult {
  totalInfractions: number;
  byStatus: Record<InfractionStatus, number>;
  byMonth: { month: string; count: number }[];
  topUnits: {
    unitId: number;
    identifier: string;
    condominiumName: string;
    count: number;
  }[];
  approvalRate: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Infraction)
    private readonly repo: Repository<Infraction>,
  ) {}

  async getMetrics(
    companyId?: number | null,
    isMaster = false,
  ): Promise<DashboardResult> {
    const base = this.repo
      .createQueryBuilder('i')
      .leftJoin('i.unit', 'unit')
      .leftJoin('unit.condominium', 'condo');

    if (!isMaster && companyId) {
      base.where('condo.companyId = :companyId', { companyId });
    }

    const [totalInfractions, byStatusRows, byMonthRows, topUnitsRows] =
      await Promise.all([
        base.clone().getCount(),

        base
          .clone()
          .select('i.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('i.status')
          .getRawMany<{ status: InfractionStatus; count: string }>(),

        base
          .clone()
          .select("TO_CHAR(i.occurrenceDate, 'YYYY-MM')", 'month')
          .addSelect('COUNT(*)', 'count')
          .andWhere("i.occurrenceDate >= NOW() - INTERVAL '6 months'")
          .groupBy("TO_CHAR(i.occurrenceDate, 'YYYY-MM')")
          .orderBy("TO_CHAR(i.occurrenceDate, 'YYYY-MM')", 'ASC')
          .getRawMany<{ month: string; count: string }>(),

        base
          .clone()
          .select('unit.id', 'unitId')
          .addSelect('unit.identifier', 'identifier')
          .addSelect('condo.name', 'condominiumName')
          .addSelect('COUNT(*)', 'count')
          .groupBy('unit.id')
          .addGroupBy('unit.identifier')
          .addGroupBy('condo.name')
          .orderBy('COUNT(*)', 'DESC')
          .limit(5)
          .getRawMany<{
            unitId: number;
            identifier: string;
            condominiumName: string;
            count: string;
          }>(),
      ]);

    const byStatus = Object.values(InfractionStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<InfractionStatus, number>,
    );
    for (const row of byStatusRows) {
      byStatus[row.status] = Number(row.count);
    }

    const approvedCount =
      (byStatus[InfractionStatus.APPROVED] ?? 0) +
      (byStatus[InfractionStatus.SENT] ?? 0);
    const approvalRate =
      totalInfractions > 0
        ? Math.round((approvedCount / totalInfractions) * 100)
        : 0;

    return {
      totalInfractions,
      byStatus,
      byMonth: byMonthRows.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      topUnits: topUnitsRows.map((r) => ({
        unitId: Number(r.unitId),
        identifier: r.identifier,
        condominiumName: r.condominiumName,
        count: Number(r.count),
      })),
      approvalRate,
    };
  }
}
