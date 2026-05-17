import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { UserCondominium } from '../../users/entities/user-condominium.entity';

@Entity()
export class Condominium {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  cnpj: string;

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

  @OneToMany(() => UserCondominium, (uc) => uc.condominium)
  memberships: UserCondominium[];
}
