import { Unidade } from 'src/unidades/entities/unidade.entity';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Infracao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  descricao: string;

  @CreateDateColumn()
  data_ocorrencia: Date;

  @ManyToOne(() => Unidade, (unidade) => unidade.infracoes)
  unidade: Unidade;
}