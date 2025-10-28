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
    private readonly infractionsRepository: Repository<Infraction>, private readonly unitsService: UnitsService, private readonly iaService: IaService, private readonly pdfService: PdfService) { }
    async create(dto: CreateInfractionDto) {
        const unit = await this.unitsService.findOne(dto.unitId);
        const infraction = this.infractionsRepository.create({
            description: dto.description,
            unit,
        });
        return this.infractionsRepository.save(infraction);
    }
    async findAll(unitId?: number) {
        if (unitId) {
            await this.unitsService.findOne(unitId);
            return this.infractionsRepository.find({
                where: { unit: { id: unitId } },
            });
        }
        return this.infractionsRepository.find({ relations: ['unit'] });
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
    async analyze(id: number) {
        const infraction = await this.findOne(id);
        const aiResult = await this.iaService.analisarInfracao(infraction);
        infraction.formalDescription =
            (aiResult as any).descricao_formal ?? (aiResult as any).formalDescription;
        infraction.suggestedPenalty =
            (aiResult as any).penalidade_sugerida ??
                (aiResult as any).suggestedPenalty;
        infraction.status = InfractionStatus.ANALYZED;
        return this.infractionsRepository.save(infraction);
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
            throw new NotFoundException(`The infraction with ID #${id} has not been analyzed by AI yet.`);
        }
        return this.pdfService.gerarDocumentoInfracao(infraction);
    }
}
