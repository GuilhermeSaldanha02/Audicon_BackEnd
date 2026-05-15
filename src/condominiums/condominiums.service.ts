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
import { UserCondominium } from '../users/entities/user-condominium.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { AddMemberDto } from './dto/add-member.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CondominiumsService {
  constructor(
    @InjectRepository(Condominium)
    private readonly condominiumsRepository: Repository<Condominium>,
    @InjectRepository(UserCondominium)
    private readonly ucRepository: Repository<UserCondominium>,
    private readonly usersService: UsersService,
  ) {}

  async create(createCondominiumDto: CreateCondominiumDto, userId: number) {
    try {
      const newCondominium = this.condominiumsRepository.create(createCondominiumDto);
      const saved = await this.condominiumsRepository.save(newCondominium);

      const membership = this.ucRepository.create({
        userId,
        condominiumId: saved.id,
        role: UserRole.ADMIN,
      });
      await this.ucRepository.save(membership);

      return saved;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException('A condominium with this CNPJ already exists.');
      }
      throw new InternalServerErrorException('Failed to create condominium.');
    }
  }

  async findAll(userId: number) {
    return this.condominiumsRepository
      .createQueryBuilder('c')
      .innerJoin('c.memberships', 'uc', 'uc.userId = :userId', { userId })
      .getMany();
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

  async addMember(condominiumId: number, dto: AddMemberDto) {
    await this.findOne(condominiumId);
    const user = await this.usersService.findOneByEmail(dto.email);
    if (!user) {
      throw new NotFoundException(`User with email ${dto.email} not found.`);
    }

    const existing = await this.ucRepository.findOne({
      where: { userId: user.id, condominiumId },
    });
    if (existing) {
      existing.role = dto.role;
      return this.ucRepository.save(existing);
    }

    const membership = this.ucRepository.create({
      userId: user.id,
      condominiumId,
      role: dto.role,
    });
    return this.ucRepository.save(membership);
  }
}
