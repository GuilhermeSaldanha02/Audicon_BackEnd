import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Infraction } from './infraction.entity';

@Entity()
export class InfractionImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => Infraction, (infraction) => infraction.images, {
    onDelete: 'CASCADE',
  })
  infraction: Infraction;

  @Column({ type: 'varchar' })
  filename: string;

  @Column({ type: 'varchar' })
  mimetype: string;

  @Column({ type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'bytea', select: false })
  content: Buffer;

  @CreateDateColumn()
  uploadedAt: Date;
}
