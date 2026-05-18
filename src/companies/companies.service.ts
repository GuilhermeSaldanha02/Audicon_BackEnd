import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

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
  ) {}

  async create(dto: CreateCompanyDto): Promise<CreatedCompanyResult> {
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
      });
      const savedUser = await this.usersRepository.save(user);

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
      if (
        err instanceof QueryFailedError &&
        (err as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException('CNPJ ou e-mail do admin já cadastrados.');
      }
      throw new InternalServerErrorException('Falha ao criar empresa.');
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companiesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Company> {
    const company = await this.companiesRepository.findOneBy({ id });
    if (!company) {
      throw new NotFoundException(`Empresa #${id} não encontrada.`);
    }
    return company;
  }
}

function generateTempPassword(): string {
  // 12 chars, alphanumeric, mixed case, no ambiguous chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return out;
}
