import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.usersRepository.findOne({
      where: { email },
    }) as Promise<User | null>;
  }
  async findOneById(id: number): Promise<User | undefined> {
    return this.usersRepository.findOneBy({ id });
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
