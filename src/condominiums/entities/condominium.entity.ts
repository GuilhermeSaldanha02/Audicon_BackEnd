import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';

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

  @OneToMany(() => Unit, (unit) => unit.condominium)
  units: Unit[];
}
