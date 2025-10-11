import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
