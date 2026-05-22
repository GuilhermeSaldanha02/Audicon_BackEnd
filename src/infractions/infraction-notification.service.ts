import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { PdfService } from 'src/pdf/pdf.service';
import { MailService } from 'src/mail/mail.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { ImagesService } from './images.service';
import { AuditService, Actor } from 'src/audit/audit.service';

@Injectable()
export class InfractionNotificationService {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
    private readonly pdfService: PdfService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
    private readonly imagesService: ImagesService,
    private readonly auditService: AuditService,
  ) {}

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
