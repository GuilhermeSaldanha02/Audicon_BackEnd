import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction =
  | 'INFRACTION_CREATED'
  | 'INFRACTION_APPROVED'
  | 'INFRACTION_SENT'
  | 'INFRACTION_WHATSAPP_SENT'
  | 'INFRACTION_DELETED'
  | 'CONDOMINIUM_CREATED'
  | 'CONDOMINIUM_DELETED'
  | 'COMPANY_CREATED'
  | 'EMPLOYEE_CREATED';

export type AuditEntity = 'infraction' | 'condominium' | 'company' | 'employee';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'integer', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', nullable: true })
  userEmail: string | null;

  @Column({ type: 'boolean', default: false })
  userIsMaster: boolean;

  @Index()
  @Column({ type: 'integer', nullable: true })
  companyId: number | null;

  @Index()
  @Column({ type: 'varchar' })
  action: AuditAction;

  @Index()
  @Column({ type: 'varchar' })
  entity: AuditEntity;

  @Column({ type: 'integer', nullable: true })
  entityId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any> | null;
}
