import { Condominio } from 'src/condominios/entities/condominio.entity';
import { Infracao } from 'src/infracoes/entities/infracao.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

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

  @OneToMany(() => Infracao, (infracao) => infracao.unidade)
  infracoes: Infracao[];
}