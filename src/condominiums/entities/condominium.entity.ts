import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { Company } from '../../companies/entities/company.entity';

@Entity()
export class Condominium {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  cnpj: string;

  @Index()
  @ManyToOne(() => Company, (company) => company.condominiums, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  company: Company;

  @Column({ type: 'integer' })
  companyId: number;

  @Column()
  address: string;

  @Column({ type: 'varchar', nullable: true })
  regimentoFilename: string | null;

  @Column({ type: 'bytea', nullable: true, select: false })
  regimentoContent: Buffer | null;

  @Column({ type: 'timestamp', nullable: true })
  regimentoUploadedAt: Date | null;

  @OneToMany(() => Unit, (unit) => unit.condominium)
  units: Unit[];

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
