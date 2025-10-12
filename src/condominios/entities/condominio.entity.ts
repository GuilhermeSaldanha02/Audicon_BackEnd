import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Unidade } from 'src/unidades/entities/unidade.entity';

@Entity()
export class Condominio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nome: string;

  @Column({ unique: true })
  cnpj: string;

  @Column()
  endereco: string;

  @OneToMany(() => Unidade, (unidade) => unidade.condominio)
  unidades: Unidade[];
}
