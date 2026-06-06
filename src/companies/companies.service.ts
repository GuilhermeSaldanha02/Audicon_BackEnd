import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService, Actor } from '../audit/audit.service';
import { SystemRole } from '../common/enums/system-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwOnUniqueViolation } from '../common/helpers/unique-violation.helper';
import * as crypto from 'crypto';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { Condominium } from '../condominiums/entities/condominium.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

export interface CreatedCompanyResult {
  company: Company;
  admin: {
    id: number;
    email: string;
    nome: string;
    tempPassword: string;
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Condominium)
    private readonly condominiumsRepository: Repository<Condominium>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateCompanyDto,
    actor?: Actor,
  ): Promise<CreatedCompanyResult> {
    try {
      const company = this.companiesRepository.create({
        name: dto.name,
        cnpj: dto.cnpj,
      });
      const savedCompany = await this.companiesRepository.save(company);

      const tempPassword = generateTempPassword();
      const user = this.usersRepository.create({
        nome: dto.admin.nome,
        email: dto.admin.email,
        senha: tempPassword,
        isMaster: false,
        companyId: savedCompany.id,
        mustChangePassword: true,
        role: SystemRole.GERENTE,
      });
      const savedUser = await this.usersRepository.save(user);

      if (actor) {
        this.auditService.log({
          actor,
          action: 'COMPANY_CREATED',
          entity: 'company',
          entityId: savedCompany.id,
          context: { name: savedCompany.name, cnpj: savedCompany.cnpj },
          companyIdOverride: savedCompany.id,
        });
      }
      return {
        company: savedCompany,
        admin: {
          id: savedUser.id,
          email: savedUser.email,
          nome: savedUser.nome,
          tempPassword,
        },
      };
    } catch (err) {
      throwOnUniqueViolation(err, 'CNPJ ou e-mail do admin já cadastrados.');
      throw new InternalServerErrorException('Falha ao criar empresa.');
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companiesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async createEmployee(
    companyId: number,
    dto: { nome: string; email: string },
    actor?: Actor,
  ): Promise<{
    id: number;
    nome: string;
    email: string;
    tempPassword: string;
  }> {
    if (!companyId) {
      throw new BadRequestException(
        'Solicitante não está vinculado a uma empresa.',
      );
    }
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `E-mail ${dto.email} já está em uso por outro usuário.`,
      );
    }
    const tempPassword = generateTempPassword();
    const user = this.usersRepository.create({
      nome: dto.nome,
      email: dto.email,
      senha: tempPassword,
      isMaster: false,
      companyId,
      mustChangePassword: true,
      role: SystemRole.FUNCIONARIO,
    });
    const saved = await this.usersRepository.save(user);
    if (actor) {
      this.auditService.log({
        actor,
        action: 'EMPLOYEE_CREATED',
        entity: 'employee',
        entityId: saved.id,
        context: { email: saved.email, nome: saved.nome },
      });
    }
    return {
      id: saved.id,
      nome: saved.nome,
      email: saved.email,
      tempPassword,
    };
  }

  async listUsersOfCompany(
    companyId: number,
    includeInactive = false,
  ): Promise<
    Array<{
      id: number;
      nome: string;
      email: string;
      role: SystemRole;
      deletedAt: Date | null;
    }>
  > {
    await this.findOne(companyId);
    const users = await this.usersRepository.find({
      where: { companyId, isMaster: false },
      // R-15: inclui role para o front diferenciar GERENTE de FUNCIONARIO.
      // R-16: inclui deletedAt; por padrão o TypeORM esconde soft-deleted —
      // só com includeInactive (withDeleted) os desativados aparecem.
      select: ['id', 'nome', 'email', 'role', 'deletedAt'],
      order: { id: 'ASC' },
      withDeleted: includeInactive,
    });
    return users;
  }

  /**
   * R-16: localiza o FUNCIONARIO-alvo de uma operação de gestão (editar/
   * desativar), aplicando o escopo de alvo:
   * - empresa precisa existir (404);
   * - alvo precisa existir E pertencer à empresa do path (senão 404 — não
   *   vaza existência cross-tenant);
   * - alvo NÃO pode ser master nem GERENTE (403) — "MASTER não regride" e o
   *   Gerente não atinge a si nem outro Gerente por esta rota.
   *
   * Usa find* (auto-filtra soft-deleted): um funcionário já desativado é
   * tratado como inexistente (reativação fica para a Fase F).
   */
  private async findManageableEmployee(
    companyId: number,
    userId: number,
  ): Promise<User> {
    await this.findOne(companyId);
    const target = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (!target || target.companyId !== companyId) {
      throw new NotFoundException(
        `Funcionário #${userId} não encontrado nesta empresa.`,
      );
    }
    if (target.isMaster || target.role !== SystemRole.FUNCIONARIO) {
      throw new ForbiddenException(
        'Apenas funcionários (role FUNCIONARIO) podem ser geridos por esta rota.',
      );
    }
    return target;
  }

  async updateEmployee(
    companyId: number,
    userId: number,
    dto: UpdateEmployeeDto,
    actor: Actor,
  ): Promise<{ id: number; nome: string; email: string; role: SystemRole }> {
    const target = await this.findManageableEmployee(companyId, userId);
    if (dto.nome !== undefined) target.nome = dto.nome;
    if (dto.email !== undefined) target.email = dto.email;
    try {
      const saved = await this.usersRepository.save(target);
      this.auditService.log({
        actor,
        action: 'EMPLOYEE_UPDATED',
        entity: 'employee',
        entityId: saved.id,
        context: { nome: saved.nome, email: saved.email },
      });
      return {
        id: saved.id,
        nome: saved.nome,
        email: saved.email,
        role: saved.role,
      };
    } catch (err) {
      throwOnUniqueViolation(err, 'E-mail já está em uso por outro usuário.');
      throw err;
    }
  }

  async deactivateEmployee(
    companyId: number,
    userId: number,
    actor: Actor,
  ): Promise<{ id: number }> {
    const target = await this.findManageableEmployee(companyId, userId);
    // Soft-delete: marca deletedAt, NÃO remove a linha. O acesso é revogado no
    // próximo request/login (ver auth.service e jwt.strategy). Histórico de
    // auditoria (audit_log denormalizado, sem FK) permanece intacto.
    await this.usersRepository.softDelete(target.id);
    this.auditService.log({
      actor,
      action: 'EMPLOYEE_DEACTIVATED',
      entity: 'employee',
      entityId: target.id,
      context: { email: target.email, nome: target.nome },
    });
    return { id: target.id };
  }

  async resetPassword(opts: {
    companyId: number;
    targetUserId: number;
    requesterId?: number;
    enforceNotAdmin: boolean;
    actor: Actor;
  }): Promise<{ id: number; email: string; tempPassword: string }> {
    if (opts.requesterId === opts.targetUserId) {
      throw new BadRequestException(
        'Não é possível resetar a própria senha por esta rota.',
      );
    }
    const target = await this.usersRepository.findOne({
      where: { id: opts.targetUserId },
    });
    if (!target) {
      throw new NotFoundException(
        `Usuário #${opts.targetUserId} não encontrado.`,
      );
    }
    if (target.companyId !== opts.companyId) {
      throw new ForbiddenException('Usuário não pertence à empresa informada.');
    }
    if (target.isMaster) {
      throw new ForbiddenException(
        'Não é possível resetar senha de usuário master por endpoint.',
      );
    }
    if (opts.enforceNotAdmin && target.role === SystemRole.GERENTE) {
      throw new ForbiddenException(
        'Apenas master pode resetar senha de gerente.',
      );
    }
    const tempPassword = generateTempPassword();
    target.senha = await bcrypt.hash(tempPassword, 10);
    target.mustChangePassword = true;
    await this.usersRepository.save(target);
    this.auditService.log({
      actor: opts.actor,
      action: 'EMPLOYEE_PASSWORD_RESET',
      entity: 'employee',
      entityId: target.id,
      context: { email: target.email },
    });
    return {
      id: target.id,
      email: target.email,
      tempPassword,
    };
  }

  async update(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);
    if (dto.name !== undefined) company.name = dto.name;
    if (dto.cnpj !== undefined) company.cnpj = dto.cnpj;
    try {
      return await this.companiesRepository.save(company);
    } catch (err) {
      throwOnUniqueViolation(err, 'CNPJ já cadastrado.');
      throw err;
    }
  }

  async findOne(id: number): Promise<Company> {
    const company = await this.companiesRepository.findOneBy({ id });
    if (!company) {
      throw new NotFoundException(`Empresa #${id} não encontrada.`);
    }
    return company;
  }

  async remove(id: number, actor: Actor): Promise<{ id: number }> {
    const company = await this.findOne(id);

    // Bloqueia se houver condomínios ATIVOS (não soft-deleted)
    const activeCondo = await this.condominiumsRepository.count({
      where: { companyId: id },
    });
    if (activeCondo > 0) {
      throw new ConflictException(
        `A empresa possui ${activeCondo} condomínio(s) ativo(s). Remova-os antes de excluir a empresa.`,
      );
    }

    // Remove dados em cascata dos condomínios soft-deleted que ainda referenciam a empresa
    // (as FKs do BD são RESTRICT, então precisamos limpar manualmente na ordem correta)
    const em = this.condominiumsRepository.manager;
    await em.query(
      `DELETE FROM infraction
       WHERE "unitId" IN (
         SELECT id FROM unit
         WHERE "condominiumId" IN (SELECT id FROM condominium WHERE "companyId" = $1)
       )`,
      [id],
    );
    await em.query(
      `DELETE FROM unit
       WHERE "condominiumId" IN (SELECT id FROM condominium WHERE "companyId" = $1)`,
      [id],
    );
    await em.query(`DELETE FROM condominium WHERE "companyId" = $1`, [id]);

    await this.usersRepository.delete({ companyId: id, isMaster: false });
    await this.companiesRepository.delete({ id });
    this.auditService.log({
      actor,
      action: 'COMPANY_DELETED',
      entity: 'company',
      entityId: id,
      context: { name: company.name, cnpj: company.cnpj },
      companyIdOverride: id,
    });
    return { id };
  }
}

export function generateTempPassword(): string {
  // 12 chars, alphanumeric, mixed case, no ambiguous chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return out;
}
