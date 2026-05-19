import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Infraction } from 'src/infractions/entities/infraction.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationChannel } from 'src/notifications/entities/notification.entity';

export interface SendInfractionAlertParams {
  infraction: Infraction;
  phone: string;
}

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private instanceId: string | undefined;
  private token: string | undefined;
  private clientToken: string | undefined;
  private nodeEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.instanceId = this.configService.get<string>('ZAPI_INSTANCE_ID');
    this.token = this.configService.get<string>('ZAPI_TOKEN');
    this.clientToken = this.configService.get<string>('ZAPI_CLIENT_TOKEN');
    this.nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  onModuleInit() {
    if (this.isConfigured()) {
      this.logger.log(
        `Cliente Z-API inicializado (instance: ${this.instanceId}).`,
      );
    } else {
      this.logger.warn(
        'ZAPI_* ausente. Operando em modo mock (apenas dev/test).',
      );
    }
  }

  private isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }

  static normalizePhone(raw: string): string {
    const digits = raw.replace(/\D+/g, '');
    if (digits.length < 10) {
      throw new Error(`Phone number too short: ${raw}`);
    }
    // Assume Brazilian; prepend 55 if not present and length is 10 or 11
    if (
      (digits.length === 10 || digits.length === 11) &&
      !digits.startsWith('55')
    ) {
      return `55${digits}`;
    }
    return digits;
  }

  async sendInfractionAlert({
    infraction,
    phone,
  }: SendInfractionAlertParams): Promise<{ id: string }> {
    const normalizedPhone = WhatsappService.normalizePhone(phone);
    const message = this.buildMessage(infraction);

    if (!this.isConfigured()) {
      this.logger.warn(
        `[MOCK] WhatsApp simulado para ${normalizedPhone}. Mensagem: ${message.slice(0, 80)}...`,
      );
      const mockId = `mock-${Date.now()}`;
      await this.notificationsService.record({
        infractionId: infraction.id,
        channel: NotificationChannel.WHATSAPP,
        recipient: normalizedPhone,
        providerId: mockId,
      });
      return { id: mockId };
    }

    const url = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}/send-text`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': this.clientToken!,
      },
      body: JSON.stringify({ phone: normalizedPhone, message }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `Falha Z-API: HTTP ${response.status} body=${body.slice(0, 200)}`,
      );
      throw new Error(`Z-API error: HTTP ${response.status}`);
    }
    const data = (await response.json().catch(() => ({}))) as any;
    this.logger.log(
      `WhatsApp enviado via Z-API para ${normalizedPhone} (messageId: ${data?.messageId ?? data?.id ?? 'n/a'}).`,
    );
    const providerId = data?.messageId ?? data?.id ?? null;
    await this.notificationsService.record({
      infractionId: infraction.id,
      channel: NotificationChannel.WHATSAPP,
      recipient: normalizedPhone,
      providerId,
    });
    return { id: providerId ?? '' };
  }

  private buildMessage(infraction: Infraction): string {
    const ownerName = infraction.unit?.ownerName ?? 'morador(a)';
    const identifier = infraction.unit?.identifier ?? '?';
    const condo = infraction.unit?.condominium?.name ?? 'condomínio';
    const email = infraction.unit?.residentEmail;
    const emailLine = email
      ? `O documento completo foi enviado por e-mail para ${email}.`
      : 'O documento completo foi enviado por e-mail.';
    return [
      `Olá, ${ownerName}.`,
      '',
      `Você recebeu uma notificação de infração relacionada à sua unidade ${identifier} no ${condo}.`,
      '',
      emailLine,
      '',
      'Em caso de dúvidas, entre em contato com a administração.',
    ].join('\n');
  }
}
