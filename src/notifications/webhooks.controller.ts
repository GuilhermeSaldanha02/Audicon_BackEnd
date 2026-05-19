import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { NotificationStatus } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

const RESEND_EVENT_MAP: Record<string, NotificationStatus> = {
  'email.delivered': NotificationStatus.DELIVERED,
  'email.opened': NotificationStatus.OPENED,
  'email.clicked': NotificationStatus.CLICKED,
  'email.bounced': NotificationStatus.BOUNCED,
  'email.complained': NotificationStatus.FAILED,
  'email.delivery_delayed': NotificationStatus.SENT,
};

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Webhook do Resend para atualização de status' })
  @HttpCode(200)
  @Post('resend')
  async resend(
    @Req() req: Request,
    @Headers('svix-signature') signature: string | undefined,
    @Headers('svix-timestamp') timestamp: string | undefined,
    @Headers('svix-id') svixId: string | undefined,
    @Body() body: any,
  ) {
    const secret = this.configService.get<string>('RESEND_WEBHOOK_SECRET');
    if (secret) {
      this.verifySignature(req, secret, signature, timestamp, svixId);
    }

    const type: string = body?.type ?? '';
    const emailId: string | undefined = body?.data?.email_id ?? body?.data?.id;
    const status = RESEND_EVENT_MAP[type];

    if (!status) {
      this.logger.warn(`Resend event ignorado: ${type}`);
      return { ignored: true };
    }
    if (!emailId) {
      this.logger.warn(`Resend event sem email_id (type=${type})`);
      return { ignored: true };
    }

    const failureReason =
      status === NotificationStatus.BOUNCED ||
      status === NotificationStatus.FAILED
        ? (body?.data?.reason ?? null)
        : null;

    const updated = await this.notificationsService.updateStatus(
      emailId,
      status,
      failureReason,
    );
    return { updated };
  }

  private verifySignature(
    req: Request,
    secret: string,
    signature: string | undefined,
    timestamp: string | undefined,
    svixId: string | undefined,
  ): void {
    if (!signature || !timestamp || !svixId) {
      throw new UnauthorizedException('Missing svix headers');
    }
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
    const signedPayload = `${svixId}.${timestamp}.${rawBody}`;
    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    let keyBuffer: Buffer;
    try {
      keyBuffer = Buffer.from(cleanSecret, 'base64');
    } catch {
      throw new BadRequestException('Invalid RESEND_WEBHOOK_SECRET');
    }
    const expected = createHmac('sha256', keyBuffer)
      .update(signedPayload)
      .digest('base64');

    const signatures = signature.split(' ').map((s) => s.split(',')[1]);
    const ok = signatures.some((s) => {
      try {
        return (
          s != null &&
          s.length === expected.length &&
          timingSafeEqual(Buffer.from(s), Buffer.from(expected))
        );
      } catch {
        return false;
      }
    });
    if (!ok) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
