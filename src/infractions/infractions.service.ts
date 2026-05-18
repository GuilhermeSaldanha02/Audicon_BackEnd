import {
  BadRequestException,
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
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaginatedResult } from 'src/common/dto/paginated-result.dto';
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
  ) {}
  async create(dto: CreateInfractionDto) {
    const unit = await this.unitsService.findOne(dto.unitId);
    const infraction = this.infractionsRepository.create({
      description: dto.description,
      unit,
    });
    return this.infractionsRepository.save(infraction);
  }
  async findAll(
    pagination: PaginationDto,
    unitId?: number,
  ): Promise<PaginatedResult<Infraction>> {
    const { page, limit } = pagination;
    const qb = this.infractionsRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.unit', 'unit')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('i.occurrenceDate', 'DESC');

    if (unitId) {
      await this.unitsService.findOne(unitId);
      qb.where('unit.id = :unitId', { unitId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
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
  async remove(id: number) {
    await this.findOne(id);
    await this.infractionsRepository.delete(id);
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
  async approve(id: number, dto: ApproveInfractionDto = {}) {
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
    return this.infractionsRepository.save(infraction);
  }
  async send(id: number) {
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
    return this.infractionsRepository.save(infraction);
  }
  async sendWhatsapp(id: number) {
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
    return this.infractionsRepository.save(infraction);
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
