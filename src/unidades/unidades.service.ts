import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CondominiosService } from 'src/condominios/condominios.service';
import { CreateUnidadeDto } from './dto/create-unidade.dto';
import { UpdateUnidadeDto } from './dto/update-unidade.dto';
import { Unidade } from './entities/unidade.entity';

@Injectable()
export class UnidadesService {
  constructor(
    @InjectRepository(Unidade)
    private readonly unidadesRepository: Repository<Unidade>,
    private readonly condominiosService: CondominiosService,
  ) {}

  async create(condominioId: number, createUnidadeDto: CreateUnidadeDto) {
    const condominio = await this.condominiosService.findOne(condominioId);
    const newUnidade = this.unidadesRepository.create({
      ...createUnidadeDto,
      condominio,
    });
    return this.unidadesRepository.save(newUnidade);
  }

  async findAll(condominioId: number) {
    await this.condominiosService.findOne(condominioId);
    return this.unidadesRepository.find({
      where: { condominio: { id: condominioId } },
    });
  }

  async findOne(id: number) {
    const unidade = await this.unidadesRepository.findOneBy({ id });
    if (!unidade) {
      throw new NotFoundException(`Unidade com ID #${id} não encontrada.`);
    }
    return unidade;
  }

  async update(id: number, updateUnidadeDto: UpdateUnidadeDto) {
    await this.findOne(id);
    await this.unidadesRepository.update(id, updateUnidadeDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.unidadesRepository.delete(id);
  }
}
