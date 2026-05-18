import { Condominium } from '../../condominiums/entities/condominium.entity';
import { Infraction } from '../../infractions/entities/infraction.entity';
import {
  Column,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity()
export class Unit {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  identifier: string;
  @Column()
  ownerName: string;
  @Column({ type: 'varchar', nullable: true })
  residentEmail: string | null;
  @Column({ type: 'varchar', nullable: true })
  residentPhone: string | null;
  @ManyToOne(() => Condominium, (condominium) => condominium.units)
  condominium: Condominium;
  @OneToMany(() => Infraction, (infraction) => infraction.unit)
  infractions: Infraction[];
  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
