import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserCondominium } from './user-condominium.entity';
import { Company } from '../../companies/entities/company.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column()
  senha: string;

  @Column({ type: 'boolean', default: false })
  isMaster: boolean;

  @Index()
  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  company: Company | null;

  @Column({ type: 'integer', nullable: true })
  companyId: number | null;

  @OneToMany(() => UserCondominium, (uc) => uc.user)
  memberships: UserCondominium[];

  @BeforeInsert()
  async hashSenha() {
    this.senha = await bcrypt.hash(this.senha, 10);
  }
}
