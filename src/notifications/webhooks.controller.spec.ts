import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { NotificationsService } from './notifications.service';
import { NotificationStatus } from './entities/notification.entity';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let notifications: { updateStatus: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    notifications = { updateStatus: jest.fn().mockResolvedValue(true) };
    config = { get: jest.fn().mockReturnValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: NotificationsService, useValue: notifications },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    controller = module.get(WebhooksController);
  });

  const req = {} as any;

  it('mapeia email.delivered → DELIVERED', async () => {
    const body = { type: 'email.delivered', data: { email_id: 'abc' } };
    const result = await controller.resend(
      req,
      undefined,
      undefined,
      undefined,
      body,
    );
    expect(notifications.updateStatus).toHaveBeenCalledWith(
      'abc',
      NotificationStatus.DELIVERED,
      null,
    );
    expect(result).toEqual({ updated: true });
  });

  it('mapeia email.opened → OPENED', async () => {
    const body = { type: 'email.opened', data: { email_id: 'xyz' } };
    await controller.resend(req, undefined, undefined, undefined, body);
    expect(notifications.updateStatus).toHaveBeenCalledWith(
      'xyz',
      NotificationStatus.OPENED,
      null,
    );
  });

  it('mapeia email.bounced → BOUNCED com failureReason', async () => {
    const body = {
      type: 'email.bounced',
      data: { email_id: 'b1', reason: 'mailbox full' },
    };
    await controller.resend(req, undefined, undefined, undefined, body);
    expect(notifications.updateStatus).toHaveBeenCalledWith(
      'b1',
      NotificationStatus.BOUNCED,
      'mailbox full',
    );
  });

  it('ignora eventos desconhecidos', async () => {
    const body = { type: 'email.foo', data: { email_id: 'abc' } };
    const result = await controller.resend(
      req,
      undefined,
      undefined,
      undefined,
      body,
    );
    expect(notifications.updateStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ ignored: true });
  });

  it('ignora quando email_id ausente', async () => {
    const body = { type: 'email.delivered', data: {} };
    const result = await controller.resend(
      req,
      undefined,
      undefined,
      undefined,
      body,
    );
    expect(notifications.updateStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ ignored: true });
  });

  it('rejeita quando RESEND_WEBHOOK_SECRET configurado e svix headers ausentes', async () => {
    config.get.mockReturnValue('whsec_dGVzdA==');
    const body = { type: 'email.delivered', data: { email_id: 'abc' } };
    await expect(
      controller.resend(req, undefined, undefined, undefined, body),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
