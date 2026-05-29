import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwOnUniqueViolation } from '../common/helpers/unique-violation.helper';
import { Condominium } from './entities/condominium.entity';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import { AuditService, Actor } from '../audit/audit.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult } from '../common/dto/paginated-result.dto';
import {
  assertTenantScope,
  TenantUser,
} from '../common/helpers/assert-tenant-scope';

@Injectable()
export class CondominiumsService {
  constructor(
    @InjectRepository(Condominium)
    private readonly condominiumsRepository: Repository<Condominium>,
    private readonly auditService: AuditService,
  ) {}

  async create(createCondominiumDto: CreateCondominiumDto, actor?: Actor) {
    try {
      const saved = await this.condominiumsRepository.save(
        this.condominiumsRepository.create(createCondominiumDto),
      );

      if (actor) {
        this.auditService.log({
          actor,
          action: 'CONDOMINIUM_CREATED',
          entity: 'condominium',
          entityId: saved.id,
          context: { name: saved.name, cnpj: saved.cnpj },
        });
      }
      return saved;
    } catch (error) {
      throwOnUniqueViolation(
        error,
        'A condominium with this CNPJ already exists.',
      );
      /* throwOnUniqueViolation always throws; line below satisfies TS */
      throw new InternalServerErrorException('Failed to create condominium.');
    }
  }

  async findAll(
    pagination: PaginationDto,
    user: TenantUser,
  ): Promise<PaginatedResult<Condominium>> {
    const scope = assertTenantScope(user);
    const { page, limit } = pagination;
    const qb = this.condominiumsRepository.createQueryBuilder('c');
    if (scope.companyId !== null) {
      qb.where('c.companyId = :companyId', { companyId: scope.companyId });
    }
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  async findByCompany(companyId: number): Promise<Condominium[]> {
    return this.condominiumsRepository.find({
      where: { companyId },
      order: { name: 'ASC' },
    });
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

  async remove(id: number, actor?: Actor) {
    await this.findOne(id);
    await this.condominiumsRepository.softDelete(id);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'CONDOMINIUM_DELETED',
        entity: 'condominium',
        entityId: id,
      });
    }
  }

  async setRegimento(condominiumId: number, filename: string, content: Buffer) {
    await this.findOne(condominiumId);
    await this.condominiumsRepository.update(condominiumId, {
      regimentoFilename: filename,
      regimentoContent: content,
      regimentoUploadedAt: new Date(),
    });
    return {
      filename,
      sizeBytes: content.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getRegimento(
    condominiumId: number,
  ): Promise<{ filename: string; content: Buffer }> {
    const row = await this.condominiumsRepository
      .createQueryBuilder('c')
      .addSelect('c.regimentoContent')
      .where('c.id = :id', { id: condominiumId })
      .getOne();
    if (!row) {
      throw new NotFoundException(
        `Condominium with ID #${condominiumId} not found.`,
      );
    }
    if (!row.regimentoContent || !row.regimentoFilename) {
      throw new NotFoundException(
        'Regimento não cadastrado para este condomínio.',
      );
    }
    return {
      filename: row.regimentoFilename,
      content: row.regimentoContent,
    };
  }

  async deleteRegimento(condominiumId: number) {
    await this.findOne(condominiumId);
    await this.condominiumsRepository.update(condominiumId, {
      regimentoFilename: null,
      regimentoContent: null,
      regimentoUploadedAt: null,
    });
  }
}
