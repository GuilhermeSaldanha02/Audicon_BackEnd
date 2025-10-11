import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Condominio } from './entities/condominio.entity';
import { CreateCondominioDto } from './dto/create-condominio.dto';
import { UpdateCondominioDto } from './dto/update-condominio.dto';

@Injectable()
export class CondominiosService {
  constructor(
    @InjectRepository(Condominio)
    private readonly condominiosRepository: Repository<Condominio>,
  ) {}

  create(createCondominioDto: CreateCondominioDto) {
    const newCondominio =
      this.condominiosRepository.create(createCondominioDto);
    return this.condominiosRepository.save(newCondominio);
  }

  findAll() {
    return this.condominiosRepository.find();
  }

  async findOne(id: number) {
    const condominio = await this.condominiosRepository.findOneBy({ id });
    if (!condominio) {
      throw new NotFoundException(`Condomínio com ID #${id} não encontrado.`);
    }
    return condominio;
  }

  async update(id: number, updateCondominioDto: UpdateCondominioDto) {
    await this.findOne(id);
    await this.condominiosRepository.update(id, updateCondominioDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.condominiosRepository.delete(id);
  }
}
