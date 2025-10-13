import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infracao } from './entities/infracao.entity';
import { CreateInfracaoDto } from './dto/create-infracao.dto';
import { UpdateInfracaoDto } from './dto/update-infracao.dto';
import { UnidadesService } from 'src/unidades/unidades.service';
import { IaService } from 'src/ia/ia.service';
import { InfracaoStatus } from './entities/infracao.entity';

@Injectable()
export class InfracoesService {
  constructor(
    @InjectRepository(Infracao)
    private readonly infracoesRepository: Repository<Infracao>,
    private readonly unidadesService: UnidadesService,
    private readonly iaService: IaService,
  ) {}

  async create(unidadeId: number, dto: CreateInfracaoDto) {
    const unidade = await this.unidadesService.findOne(unidadeId);
    const infracao = this.infracoesRepository.create({
      ...dto,
      unidade,
    });
    return this.infracoesRepository.save(infracao);
  }

  async findAll(unidadeId: number) {
    await this.unidadesService.findOne(unidadeId);
    return this.infracoesRepository.find({ where: { unidade: { id: unidadeId } } });
  }

  async findOne(id: number) {
    const infracao = await this.infracoesRepository.findOne({ where: { id }, relations: ['unidade'] });
    if (!infracao) {
      throw new NotFoundException(`Infração com ID #${id} não encontrada.`);
    }
    return infracao;
  }

  async update(id: number, dto: UpdateInfracaoDto) {
    await this.findOne(id);
    await this.infracoesRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.infracoesRepository.delete(id);
  }

  async analisar(id: number) {
    const infracao = await this.findOne(id);
    const resultadoIa = await this.iaService.analisarInfracao(infracao);
    infracao.descricao_formal = resultadoIa.descricao_formal;
    infracao.penalidade_sugerida = resultadoIa.penalidade_sugerida;
    infracao.status = InfracaoStatus.ANALISADA;
    return this.infracoesRepository.save(infracao);
  }
}
