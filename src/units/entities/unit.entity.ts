import { Condominium } from '../../condominiums/entities/condominium.entity';
import { Infraction } from '../../infractions/entities/infraction.entity';
import {
  Column,
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

  @ManyToOne(() => Condominium, (condominium) => condominium.units)
  condominium: Condominium;

  @OneToMany(() => Infraction, (infraction) => infraction.unit)
  infractions: Infraction[];
}
