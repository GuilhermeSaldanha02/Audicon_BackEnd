import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Condominium } from './entities/condominium.entity';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';

@Injectable()
export class CondominiumsService {
  constructor(
    @InjectRepository(Condominium)
    private readonly condominiumsRepository: Repository<Condominium>,
  ) {}

  async create(createCondominiumDto: CreateCondominiumDto) {
    try {
      const newCondominium =
        this.condominiumsRepository.create(createCondominiumDto);
      return await this.condominiumsRepository.save(newCondominium);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'A condominium with this CNPJ already exists.',
        );
      }
      throw new InternalServerErrorException('Failed to create condominium.');
    }
  }

  findAll() {
    return this.condominiumsRepository.find();
  }

  async findOne(id: number) {
    const condominium = await this.condominiumsRepository.findOneBy({ id });
    if (!condominium) {
      throw new NotFoundException(`Condominium with ID #${id} not found.`);
    }
    return condominium;
  }

  async update(id: number, updateCondominiumDto: UpdateCondominiumDto) {
    await this.findOne(id);
    await this.condominiumsRepository.update(id, updateCondominiumDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.condominiumsRepository.delete(id);
  }
}
