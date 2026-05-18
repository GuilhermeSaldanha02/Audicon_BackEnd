import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditAction,
  AuditEntity,
  AuditLog,
} from './entities/audit-log.entity';

export interface Actor {
  userId: number;
  email: string;
  isMaster?: boolean;
  companyId: number | null;
}

export interface AuditEntry {
  actor: Actor;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: number | null;
  context?: Record<string, any> | null;
  /**
   * Optional override of the company scope (use when actor is master but
   * the entity belongs to a specific company).
   */
  companyIdOverride?: number | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Fire-and-forget log. Errors are logged but never thrown to the caller
   * to avoid breaking the main business flow.
   */
  log(entry: AuditEntry): void {
    void this.persist(entry).catch((err) =>
      this.logger.error(
        `Falha ao persistir audit log (${entry.action} ${entry.entity}#${entry.entityId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    );
  }

  /**
   * Synchronous variant for tests / callers that need to await.
   */
  async logAsync(entry: AuditEntry): Promise<AuditLog | null> {
    try {
      return await this.persist(entry);
    } catch (err) {
      this.logger.error(
        `Falha ao persistir audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private persist(entry: AuditEntry): Promise<AuditLog> {
    const row = this.repo.create({
      userId: entry.actor.userId,
      userEmail: entry.actor.email,
      userIsMaster: !!entry.actor.isMaster,
      companyId:
        entry.companyIdOverride !== undefined
          ? entry.companyIdOverride
          : entry.actor.companyId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      context: entry.context ?? null,
    });
    return this.repo.save(row);
  }

  async list(params: {
    companyId?: number | null;
    page: number;
    limit: number;
  }): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);
    if (params.companyId !== undefined && params.companyId !== null) {
      qb.where('a.companyId = :companyId', { companyId: params.companyId });
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: params.page, limit: params.limit };
  }
}
