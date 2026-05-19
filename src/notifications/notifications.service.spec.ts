import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from './entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('record', () => {
    it('cria registro com status SENT por padrão', async () => {
      repo.save.mockResolvedValue({ id: 1 });
      const result = await service.record({
        infractionId: 10,
        channel: NotificationChannel.EMAIL,
        recipient: 'test@example.com',
        providerId: 'resend-id-1',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'email',
          recipient: 'test@example.com',
          providerId: 'resend-id-1',
          status: NotificationStatus.SENT,
        }),
      );
      expect(result).toEqual({ id: 1 });
    });

    it('retorna null e não propaga erro se save falhar', async () => {
      repo.save.mockRejectedValue(new Error('db down'));
      const result = await service.record({
        infractionId: 10,
        channel: NotificationChannel.EMAIL,
        recipient: 'x@y.com',
      });
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('atualiza pela coluna providerId', async () => {
      repo.update.mockResolvedValue({ affected: 1 });
      const ok = await service.updateStatus(
        'resend-id-1',
        NotificationStatus.DELIVERED,
      );
      expect(ok).toBe(true);
      expect(repo.update).toHaveBeenCalledWith(
        { providerId: 'resend-id-1' },
        { status: NotificationStatus.DELIVERED, failureReason: null },
      );
    });

    it('retorna false quando providerId vazio', async () => {
      const ok = await service.updateStatus('', NotificationStatus.DELIVERED);
      expect(ok).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('retorna false quando nenhuma row é atualizada', async () => {
      repo.update.mockResolvedValue({ affected: 0 });
      const ok = await service.updateStatus(
        'unknown',
        NotificationStatus.DELIVERED,
      );
      expect(ok).toBe(false);
    });
  });

  describe('findByInfraction', () => {
    it('busca por infraction.id ordenado por createdAt DESC', async () => {
      repo.find.mockResolvedValue([]);
      await service.findByInfraction(42);
      expect(repo.find).toHaveBeenCalledWith({
        where: { infraction: { id: 42 } },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
