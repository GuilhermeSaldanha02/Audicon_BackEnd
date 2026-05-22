import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwOnUniqueViolation } from '../common/helpers/unique-violation.helper';
import { CondominiumsService } from 'src/condominiums/condominiums.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Unit } from './entities/unit.entity';
@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    private readonly condominiumsService: CondominiumsService,
  ) {}
  async create(condominiumId: number, createUnitDto: CreateUnitDto) {
    const condominium = await this.condominiumsService.findOne(condominiumId);
    try {
      const newUnit = this.unitsRepository.create({
        ...createUnitDto,
        condominium,
      });
      return await this.unitsRepository.save(newUnit);
    } catch (error) {
      throwOnUniqueViolation(
        error,
        'A unit with this identifier already exists.',
      );
      throw new InternalServerErrorException('Failed to create unit.');
    }
  }
  async findAll(condominiumId: number) {
    await this.condominiumsService.findOne(condominiumId);
    return this.unitsRepository.find({
      where: { condominium: { id: condominiumId } },
    });
  }
  async findOne(id: number) {
    const unit = await this.unitsRepository.findOneBy({ id });
    if (!unit) {
      throw new NotFoundException(`Unit with ID #${id} not found.`);
    }
    return unit;
  }
  async update(id: number, updateUnitDto: UpdateUnitDto) {
    await this.findOne(id);
    await this.unitsRepository.update(id, updateUnitDto);
    return this.findOne(id);
  }
  async remove(id: number) {
    await this.findOne(id);
    await this.unitsRepository.softDelete(id);
  }
}
