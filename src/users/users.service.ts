import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}
  async create(data: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }
  async findOneByEmail(email: string): Promise<User | null> {
    // senha é select:false na entity; o login precisa do hash para o bcrypt,
    // então a re-incluímos explicitamente via addSelect (QueryBuilder, pois o
    // `select` das FindOptions é whitelist e descartaria as demais colunas).
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.senha')
      .where('user.email = :email', { email })
      .getOne();
  }
  async findOneById(id: number): Promise<User | undefined> {
    return this.usersRepository.findOneBy({ id });
  }

  async changePassword(id: number, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (newPassword.length < 8) {
      throw new BadRequestException(
        'A nova senha deve ter pelo menos 8 caracteres.',
      );
    }
    user.senha = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await this.usersRepository.save(user);
  }

  async getProfile(id: number): Promise<{
    nome: string;
    email: string;
    isMaster: boolean;
    companyName: string | null;
  }> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { company: true },
    });
    if (!user) {
      return { nome: '', email: '', isMaster: false, companyName: null };
    }
    return {
      nome: user.nome,
      email: user.email,
      isMaster: user.isMaster,
      companyName: user.company?.name ?? null,
    };
  }
}
