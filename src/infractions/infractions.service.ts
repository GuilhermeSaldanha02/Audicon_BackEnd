import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infraction, InfractionStatus } from './entities/infraction.entity';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';
import { UnitsService } from 'src/units/units.service';
import { IaService } from 'src/ia/ia.service';
import { PdfService } from 'src/pdf/pdf.service';

@Injectable()
export class InfractionsService {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
    private readonly unitsService: UnitsService,
    private readonly iaService: IaService,
    private readonly pdfService: PdfService,
  ) {}

  async create(unitId: number, dto: CreateInfractionDto) {
    const unit = await this.unitsService.findOne(unitId);
    const infraction = this.infractionsRepository.create({
      ...dto,
      unit,
    });
    return this.infractionsRepository.save(infraction);
  }

  async findAll(unitId: number) {
    await this.unitsService.findOne(unitId);
    return this.infractionsRepository.find({ where: { unit: { id: unitId } } });
  }

  async findOne(unitId: number, id: number) {
    const infraction = await this.infractionsRepository.findOne({ where: { id, unit: { id: unitId } }, relations: ['unit'] });
    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }
    return infraction;
  }

  async update(unitId: number, id: number, dto: UpdateInfractionDto) {
    await this.findOne(unitId, id);
    await this.infractionsRepository.update(id, dto);
    return this.findOne(unitId, id);
  }

  async remove(unitId: number, id: number) {
    await this.findOne(unitId, id);
    await this.infractionsRepository.delete(id);
  }

  async analyze(unitId: number, id: number) {
    const infraction = await this.findOne(unitId, id);
    const aiResult = await this.iaService.analisarInfracao(infraction);
    // Map potential Portuguese keys from IaService to new English fields
    infraction.formalDescription = (aiResult as any).descricao_formal ?? (aiResult as any).formalDescription;
    infraction.suggestedPenalty = (aiResult as any).penalidade_sugerida ?? (aiResult as any).suggestedPenalty;
    infraction.status = InfractionStatus.ANALYZED;
    return this.infractionsRepository.save(infraction);
  }

  async generateDocument(unitId: number, id: number): Promise<Buffer> {
    const infraction = await this.infractionsRepository.findOne({
      where: { id, unit: { id: unitId } },
      relations: ['unit', 'unit.condominium'],
    });

    if (!infraction) {
      throw new NotFoundException(`Infraction with ID #${id} not found.`);
    }

    if (!infraction.formalDescription) {
      throw new NotFoundException(`The infraction with ID #${id} has not been analyzed by AI yet.`);
    }

    return this.pdfService.gerarDocumentoInfracao(infraction);
  }
}
