import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebhooksController } from './webhooks.controller';
import { Infraction } from '../infractions/entities/infraction.entity';
import { InfractionAccessGuard } from '../common/guards/infraction-access.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Infraction])],
  controllers: [NotificationsController, WebhooksController],
  providers: [NotificationsService, InfractionAccessGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
