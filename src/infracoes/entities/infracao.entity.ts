import { Unidade } from 'src/unidades/entities/unidade.entity';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum InfracaoStatus {
  PENDENTE = 'pendente',
  ANALISADA = 'analisada',
  APROVADA = 'aprovada',
  ENVIADA = 'enviada',
}

@Entity()
export class Infracao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', comment: 'Descrição informal feita pelo funcionário.' })
  descricao: string;

  // --- Campos da IA ---
  @Column({ type: 'text', nullable: true, comment: 'Descrição formal gerada pela IA.' })
  descricao_formal: string;

  @Column({ nullable: true, comment: 'Penalidade sugerida pela IA (ex: Notificação, Advertência, Multa).' })
  penalidade_sugerida: string;

  @Column({
    type: 'enum',
    enum: InfracaoStatus,
    default: InfracaoStatus.PENDENTE,
    comment: 'O estado atual da infração no fluxo de trabalho.',
  })
  status: InfracaoStatus;
  // --- Fim dos Campos da IA ---

  @CreateDateColumn()
  data_ocorrencia: Date;

  @UpdateDateColumn()
  data_atualizacao: Date;

  @ManyToOne(() => Unidade, (unidade) => unidade.infracoes)
  unidade: Unidade;
}