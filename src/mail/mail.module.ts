import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
