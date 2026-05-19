import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import {
  Infraction,
  InfractionStatus,
} from '../infractions/entities/infraction.entity';
import { NotificationsService } from '../notifications/notifications.service';

const baseInfraction = (): Infraction =>
  ({
    id: 99,
    description: 'Desc',
    formalDescription: 'Texto formal <com>especiais & "aspas"',
    suggestedPenalty: 'Advertência',
    status: InfractionStatus.APPROVED,
    occurrenceDate: new Date(),
    updatedAt: new Date(),
    approvedAt: new Date(),
    sentAt: null,
    unit: { identifier: 'A-101' } as any,
  }) as Infraction;

async function build(config: Record<string, any>): Promise<MailService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MailService,
      {
        provide: ConfigService,
        useValue: { get: (k: string) => config[k] },
      },
      {
        provide: NotificationsService,
        useValue: { record: jest.fn().mockResolvedValue(null) },
      },
    ],
  }).compile();
  const service = module.get(MailService);
  service.onModuleInit();
  return service;
}

describe('MailService', () => {
  it('opera em modo mock quando RESEND_API_KEY ausente e retorna id mock', async () => {
    const service = await build({ NODE_ENV: 'test' });
    const result = await service.sendInfractionEmail({
      infraction: baseInfraction(),
      to: 'morador@teste.com',
      pdfBuffer: Buffer.from('pdf'),
    });
    expect(result.id).toMatch(/^mock-/);
  });

  it('escapa HTML especiais no template', async () => {
    const service = await build({ NODE_ENV: 'test' });
    const inf = baseInfraction();
    const html = (service as any).buildHtml(inf);
    expect(html).toContain('&lt;com&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).not.toContain('<com>');
  });

  it('chama Resend.emails.send quando RESEND_API_KEY presente', async () => {
    const service = await build({
      NODE_ENV: 'test',
      RESEND_API_KEY: 'fake-key',
      RESEND_FROM_EMAIL: 'noreply@example.com',
    });
    const sendMock = jest
      .fn()
      .mockResolvedValue({ data: { id: 'resend-id-1' }, error: null });
    (service as any).client = { emails: { send: sendMock } };
    const result = await service.sendInfractionEmail({
      infraction: baseInfraction(),
      to: 'morador@teste.com',
      pdfBuffer: Buffer.from('pdf'),
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: 'morador@teste.com',
        subject: expect.stringContaining('A-101'),
        attachments: [
          expect.objectContaining({
            filename: 'infracao-99.pdf',
            content: expect.any(String),
          }),
        ],
      }),
    );
    expect(result.id).toBe('resend-id-1');
  });

  it('propaga erro quando Resend retorna error', async () => {
    const service = await build({
      NODE_ENV: 'production',
      RESEND_API_KEY: 'fake-key',
    });
    (service as any).client = {
      emails: {
        send: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'rate-limited' },
        }),
      },
    };
    await expect(
      service.sendInfractionEmail({
        infraction: baseInfraction(),
        to: 'morador@teste.com',
        pdfBuffer: Buffer.from('pdf'),
      }),
    ).rejects.toThrow(/rate-limited/);
  });
});
