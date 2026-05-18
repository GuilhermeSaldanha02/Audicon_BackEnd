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
import { IaService } from 'src/ia/ia.service';
import { PdfService } from 'src/pdf/pdf.service';
import { CondominiumsService } from 'src/condominiums/condominiums.service';
import { MailService } from 'src/mail/mail.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { ImagesService } from './images.service';
import { AuditService, Actor } from 'src/audit/audit.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaginatedResult } from 'src/common/dto/paginated-result.dto';
import { CsvExportQueryDto } from './dto/csv-export-query.dto';
@Injectable()
export class InfractionsService {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
    private readonly unitsService: UnitsService,
    private readonly iaService: IaService,
    private readonly pdfService: PdfService,
    private readonly condominiumsService: CondominiumsService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
    private readonly imagesService: ImagesService,
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
    unitId?: number,
    requesterCompanyId?: number | null,
    isMaster = false,
  ): Promise<PaginatedResult<Infraction>> {
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
    if (!isMaster && requesterCompanyId) {
      qb.andWhere('condo.companyId = :companyId', {
        companyId: requesterCompanyId,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
  async exportCsv(
    query: CsvExportQueryDto,
    requesterCompanyId?: number | null,
    isMaster = false,
  ): Promise<string> {
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
    if (!isMaster && requesterCompanyId) {
      qb.andWhere('condo.companyId = :companyId', {
        companyId: requesterCompanyId,
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
  async send(id: number, actor?: Actor) {
    const infraction = await this.infractionsRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.condominium'],
    });
    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }
    if (infraction.status !== InfractionStatus.APPROVED) {
      throw new BadRequestException(
        `Infraction #${id} cannot be sent from status "${infraction.status}". Required status: "${InfractionStatus.APPROVED}".`,
      );
    }
    const to = infraction.unit?.residentEmail;
    if (!to) {
      throw new BadRequestException(
        `Unit of infraction #${id} has no resident email registered.`,
      );
    }
    const imageBuffers = await this.imagesService.getContentBuffers(id);
    const pdfBuffer = await this.pdfService.gerarDocumentoInfracao(
      infraction,
      imageBuffers,
    );
    await this.mailService.sendInfractionEmail({
      infraction,
      to,
      pdfBuffer,
    });
    infraction.status = InfractionStatus.SENT;
    infraction.sentAt = new Date();
    const saved = await this.infractionsRepository.save(infraction);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'INFRACTION_SENT',
        entity: 'infraction',
        entityId: id,
        context: { to },
      });
    }
    return saved;
  }
  async sendWhatsapp(id: number, actor?: Actor) {
    const infraction = await this.infractionsRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.condominium'],
    });
    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }
    if (
      infraction.status !== InfractionStatus.APPROVED &&
      infraction.status !== InfractionStatus.SENT
    ) {
      throw new BadRequestException(
        `Infraction #${id} cannot send WhatsApp from status "${infraction.status}". Required: approved or sent.`,
      );
    }
    const phone = infraction.unit?.residentPhone;
    if (!phone) {
      throw new BadRequestException(
        `Unit of infraction #${id} has no resident phone registered.`,
      );
    }
    await this.whatsappService.sendInfractionAlert({ infraction, phone });
    infraction.whatsappSentAt = new Date();
    const saved = await this.infractionsRepository.save(infraction);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'INFRACTION_WHATSAPP_SENT',
        entity: 'infraction',
        entityId: id,
        context: { phone },
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
  async generateDocument(id: number): Promise<Buffer> {
    const infraction = await this.infractionsRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.condominium'],
    });
    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }
    if (!infraction.formalDescription) {
      throw new NotFoundException(
        `The infraction with ID #${id} has not been analyzed by AI yet.`,
      );
    }
    const imageBuffers = await this.imagesService.getContentBuffers(id);
    return this.pdfService.gerarDocumentoInfracao(infraction, imageBuffers);
  }
}
