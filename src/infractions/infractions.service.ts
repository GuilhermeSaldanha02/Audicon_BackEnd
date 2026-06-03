import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';
import { ApproveInfractionDto } from './dto/approve-infraction.dto';
import { UnitsService } from 'src/units/units.service';
import { CondominiumsService } from 'src/condominiums/condominiums.service';
import { AuditService, Actor } from 'src/audit/audit.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaginatedResult } from 'src/common/dto/paginated-result.dto';
import { CsvExportQueryDto } from './dto/csv-export-query.dto';
import {
  assertTenantScope,
  TenantUser,
} from 'src/common/helpers/assert-tenant-scope';
@Injectable()
export class InfractionsService {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
    private readonly unitsService: UnitsService,
    private readonly condominiumsService: CondominiumsService,
    private readonly auditService: AuditService,
  ) {}
  async create(
    dto: CreateInfractionDto,
    requesterCompanyId?: number | null,
    isMaster = false,
    actor?: Actor,
  ) {
    const unit = await this.unitsService.findOne(dto.unitId);
    if (!isMaster) {
      const condo = await this.condominiumsService.findOne(
        (unit as any).condominium?.id ?? (await this.resolveCondoId(unit.id)),
      );
      if (condo.companyId !== requesterCompanyId) {
        throw new ForbiddenException(
          'A unidade informada pertence a outra empresa.',
        );
      }
    }
    const infraction = this.infractionsRepository.create({
      description: dto.description,
      severity: dto.severity,
      unit,
    });
    const saved = await this.infractionsRepository.save(infraction);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'INFRACTION_CREATED',
        entity: 'infraction',
        entityId: saved.id,
        context: { unitId: dto.unitId },
      });
    }
    return saved;
  }
  private async resolveCondoId(unitId: number): Promise<number> {
    const row = await this.infractionsRepository.manager
      .createQueryBuilder()
      .from('unit', 'u')
      .select('u.condominiumId', 'condominiumId')
      .where('u.id = :id', { id: unitId })
      .getRawOne<{ condominiumId: number }>();
    if (!row) throw new NotFoundException(`Unit #${unitId} not found.`);
    return row.condominiumId;
  }
  async findAll(
    pagination: PaginationDto,
    unitId: number | undefined,
    user: TenantUser,
  ): Promise<PaginatedResult<Infraction>> {
    const scope = assertTenantScope(user);
    const { page, limit } = pagination;
    const qb = this.infractionsRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.unit', 'unit')
      .leftJoin('unit.condominium', 'condo')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('i.occurrenceDate', 'DESC');

    if (unitId) {
      await this.unitsService.findOne(unitId);
      qb.where('unit.id = :unitId', { unitId });
    }
    if (scope.companyId !== null) {
      qb.andWhere('condo.companyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
  async exportCsv(query: CsvExportQueryDto, user: TenantUser): Promise<string> {
    const scope = assertTenantScope(user);
    const qb = this.infractionsRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.unit', 'unit')
      .leftJoinAndSelect('unit.condominium', 'condo')
      .orderBy('i.occurrenceDate', 'DESC');

    if (query.unitId) {
      qb.andWhere('unit.id = :unitId', { unitId: query.unitId });
    }
    if (query.status) {
      qb.andWhere('i.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('i.occurrenceDate >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('i.occurrenceDate <= :to', { to: query.to });
    }
    if (scope.companyId !== null) {
      qb.andWhere('condo.companyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    const rows = await qb.getMany();

    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s}"`
        : s;
    };
    const fmt = (d: Date | null | undefined) =>
      d ? new Date(d).toISOString() : '';

    const header =
      'id,unidade,condominio,status,descricao,data_ocorrencia,aprovado_em,enviado_em';
    const lines = rows.map((r) =>
      [
        r.id,
        escape(r.unit?.identifier),
        escape(r.unit?.condominium?.name),
        r.status,
        escape(r.description),
        fmt(r.occurrenceDate),
        fmt(r.approvedAt),
        fmt(r.sentAt),
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }

  async findOne(id: number) {
    const infraction = await this.infractionsRepository.findOne({
      where: { id },
      relations: ['unit'],
    });
    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }
    return infraction;
  }
  async update(id: number, dto: UpdateInfractionDto) {
    const infraction = await this.findOne(id);
    const updatedInfraction = Object.assign(infraction, dto);
    return this.infractionsRepository.save(updatedInfraction);
  }
  async remove(id: number, actor?: Actor) {
    await this.findOne(id);
    await this.infractionsRepository.softDelete(id);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'INFRACTION_DELETED',
        entity: 'infraction',
        entityId: id,
      });
    }
  }
  async approve(id: number, dto: ApproveInfractionDto = {}, actor?: Actor) {
    const infraction = await this.findOne(id);
    if (infraction.status !== InfractionStatus.ANALYZED) {
      throw new BadRequestException(
        `Infraction #${id} cannot be approved from status "${infraction.status}". Required status: "${InfractionStatus.ANALYZED}".`,
      );
    }
    if (dto.formalDescription !== undefined) {
      infraction.formalDescription = dto.formalDescription;
    }
    if (dto.suggestedPenalty !== undefined) {
      infraction.suggestedPenalty = dto.suggestedPenalty;
    }
    infraction.status = InfractionStatus.APPROVED;
    infraction.approvedAt = new Date();
    const saved = await this.infractionsRepository.save(infraction);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'INFRACTION_APPROVED',
        entity: 'infraction',
        entityId: id,
        context: { suggestedPenalty: saved.suggestedPenalty },
      });
    }
    return saved;
  }
  async findForReport(
    condominiumId: number,
    from?: string,
    to?: string,
  ): Promise<{ condominium: any; infractions: Infraction[] }> {
    const condominium = await this.condominiumsService.findOne(condominiumId);
    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException('`from` must be before or equal to `to`.');
    }
    const qb = this.infractionsRepository
      .createQueryBuilder('infraction')
      .leftJoinAndSelect('infraction.unit', 'unit')
      .leftJoin('unit.condominium', 'condominium')
      .where('condominium.id = :condominiumId', { condominiumId })
      .orderBy('infraction.occurrenceDate', 'ASC');
    if (from) {
      qb.andWhere('infraction.occurrenceDate >= :from', { from });
    }
    if (to) {
      qb.andWhere('infraction.occurrenceDate <= :to', { to });
    }
    const infractions = await qb.getMany();
    return { condominium, infractions };
  }
}
