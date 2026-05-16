import {
  BadRequestException,
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
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult } from '../common/dto/paginated-result.dto';

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
      const newCondominium =
        this.condominiumsRepository.create(createCondominiumDto);
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
        throw new ConflictException(
          'A condominium with this CNPJ already exists.',
        );
      }
      throw new InternalServerErrorException('Failed to create condominium.');
    }
  }

  async findAll(
    userId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Condominium>> {
    const { page, limit } = pagination;
    const [data, total] = await this.condominiumsRepository
      .createQueryBuilder('c')
      .innerJoin('c.memberships', 'uc', 'uc.userId = :userId', { userId })
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
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

  async removeMember(condominiumId: number, userId: number) {
    await this.findOne(condominiumId);

    const membership = await this.ucRepository.findOne({
      where: { userId, condominiumId },
    });
    if (!membership) {
      throw new NotFoundException(
        `User #${userId} is not a member of condominium #${condominiumId}.`,
      );
    }

    if (membership.role === UserRole.ADMIN) {
      const adminCount = await this.ucRepository.count({
        where: { condominiumId, role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last ADMIN of a condominium.',
        );
      }
    }

    await this.ucRepository.delete({ userId, condominiumId });
  }
}
