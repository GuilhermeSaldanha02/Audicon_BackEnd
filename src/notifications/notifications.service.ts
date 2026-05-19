import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from './entities/notification.entity';

export interface RecordNotificationParams {
  infractionId: number;
  channel: NotificationChannel;
  recipient: string;
  providerId?: string | null;
  status?: NotificationStatus;
  failureReason?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async record(params: RecordNotificationParams): Promise<Notification | null> {
    try {
      const entity = this.repo.create({
        infraction: { id: params.infractionId } as any,
        channel: params.channel,
        recipient: params.recipient,
        providerId: params.providerId ?? null,
        status: params.status ?? NotificationStatus.SENT,
        failureReason: params.failureReason ?? null,
      });
      return await this.repo.save(entity);
    } catch (e) {
      this.logger.error(
        `Falha ao registrar notification (infraction#${params.infractionId} ${params.channel}): ${(e as Error).message}`,
      );
      return null;
    }
  }

  async updateStatus(
    providerId: string,
    status: NotificationStatus,
    failureReason?: string | null,
  ): Promise<boolean> {
    if (!providerId) return false;
    try {
      const result = await this.repo.update(
        { providerId },
        { status, failureReason: failureReason ?? null },
      );
      return (result.affected ?? 0) > 0;
    } catch (e) {
      this.logger.error(
        `Falha ao atualizar notification status (providerId=${providerId}): ${(e as Error).message}`,
      );
      return false;
    }
  }

  async findByInfraction(infractionId: number): Promise<Notification[]> {
    return this.repo.find({
      where: { infraction: { id: infractionId } as any },
      order: { createdAt: 'DESC' },
    });
  }
}
