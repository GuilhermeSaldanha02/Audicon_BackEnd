import {
  BeforeInsert,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Company } from '../../companies/entities/company.entity';
import { SystemRole } from '../../common/enums/system-role.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  senha: string;

  @Column({ type: 'boolean', default: false })
  isMaster: boolean;

  @Column({ type: 'boolean', default: false })
  mustChangePassword: boolean;

  // Papel por empresa (modelo-alvo R-02). NOT NULL sem default no banco:
  // todo fluxo de criação deve informar o papel explicitamente.
  @Column({ type: 'enum', enum: SystemRole })
  role: SystemRole;

  @Index()
  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  company: Company | null;

  @Column({ type: 'integer', nullable: true })
  companyId: number | null;

  // R-16: soft-delete (desativação) de funcionário. NULL = ativo. O TypeORM
  // filtra linhas com deletedAt preenchido automaticamente em find*; a revogação
  // de acesso (login + request) NÃO depende só desse auto-filtro — há checagem
  // explícita de `deletedAt` no login (auth.service) e na JwtStrategy.
  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @BeforeInsert()
  async hashSenha() {
    this.senha = await bcrypt.hash(this.senha, 10);
  }
}
