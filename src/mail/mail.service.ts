import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Infraction } from 'src/infractions/entities/infraction.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationChannel } from 'src/notifications/entities/notification.entity';

export interface SendInfractionEmailParams {
  infraction: Infraction;
  to: string;
  pdfBuffer: Buffer;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private client: Resend | null = null;
  private apiKey: string | undefined;
  private fromEmail: string;
  private nodeEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ??
      'onboarding@resend.dev';
    this.nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  onModuleInit() {
    if (this.apiKey) {
      this.client = new Resend(this.apiKey);
      this.logger.log(`Cliente Resend inicializado (from: ${this.fromEmail}).`);
    } else {
      this.logger.warn(
        'RESEND_API_KEY ausente. Operando em modo mock (apenas dev/test).',
      );
    }
  }

  async sendInfractionEmail({
    infraction,
    to,
    pdfBuffer,
  }: SendInfractionEmailParams): Promise<{ id: string }> {
    const subject = `Notificação de infração — Unidade ${infraction.unit?.identifier ?? '?'}`;
    const html = this.buildHtml(infraction);
    const text = this.buildText(infraction);
    const attachments = [
      {
        filename: `infracao-${infraction.id}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ];

    if (!this.client) {
      this.logger.warn(
        `[MOCK] Envio simulado para ${to} | assunto: "${subject}" | anexo: ${pdfBuffer.length} bytes`,
      );
      const mockId = `mock-${Date.now()}`;
      await this.notificationsService.record({
        infractionId: infraction.id,
        channel: NotificationChannel.EMAIL,
        recipient: to,
        providerId: mockId,
      });
      return { id: mockId };
    }

    const { data, error } = await this.client.emails.send({
      from: this.fromEmail,
      to,
      subject,
      html,
      text,
      attachments,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail via Resend: ${JSON.stringify(error)}`,
      );
      throw new Error(`Resend error: ${error.message ?? 'unknown'}`);
    }

    this.logger.log(`E-mail enviado via Resend para ${to} (id: ${data?.id}).`);
    await this.notificationsService.record({
      infractionId: infraction.id,
      channel: NotificationChannel.EMAIL,
      recipient: to,
      providerId: data?.id ?? null,
    });
    return { id: data?.id ?? '' };
  }

  private buildHtml(infraction: Infraction): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a365d;">Notificação de Infração</h2>
  <p>Prezado(a) morador(a) da unidade <strong>${escapeHtml(infraction.unit?.identifier ?? '')}</strong>,</p>
  <p>Comunicamos o registro da seguinte infração ao regimento interno do condomínio:</p>
  <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #1a365d; margin: 20px 0;">
    <p style="margin: 0;"><strong>Descrição formal:</strong></p>
    <p style="margin: 8px 0 0 0; white-space: pre-wrap;">${escapeHtml(infraction.formalDescription ?? '')}</p>
  </div>
  <p><strong>Penalidade aplicável:</strong> ${escapeHtml(infraction.suggestedPenalty ?? '')}</p>
  <p>Em anexo segue o documento oficial em PDF.</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
  <p style="font-size: 12px; color: #718096;">
    Esta é uma notificação automática da administradora.
    Para esclarecimentos, entre em contato com a administração do condomínio.
  </p>
</body>
</html>
    `.trim();
  }

  private buildText(infraction: Infraction): string {
    return [
      'NOTIFICAÇÃO DE INFRAÇÃO',
      '',
      `Unidade: ${infraction.unit?.identifier ?? ''}`,
      '',
      'Descrição formal:',
      infraction.formalDescription ?? '',
      '',
      `Penalidade aplicável: ${infraction.suggestedPenalty ?? ''}`,
      '',
      'Em anexo segue o documento oficial em PDF.',
    ].join('\n');
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
