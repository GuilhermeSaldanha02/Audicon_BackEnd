import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Condominium } from '../../condominiums/entities/condominium.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  cnpj: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => User, (user) => user.company)
  users: User[];

  @OneToMany(() => Condominium, (c) => c.company)
  condominiums: Condominium[];
}
