import { Condominio } from 'src/condominios/entities/condominio.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Unidade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  identificador: string;

  @Column()
  proprietario_nome: string;

  @ManyToOne(() => Condominio, (condominio) => condominio.unidades)
  condominio: Condominio;
}