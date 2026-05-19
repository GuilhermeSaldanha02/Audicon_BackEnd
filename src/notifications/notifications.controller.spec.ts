import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { InfractionAccessGuard } from '../common/guards/infraction-access.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: { findByInfraction: jest.Mock };

  beforeEach(async () => {
    service = { findByInfraction: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    })
      .overrideGuard(InfractionAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(NotificationsController);
  });

  it('delega a service.findByInfraction', async () => {
    await controller.findByInfraction(7);
    expect(service.findByInfraction).toHaveBeenCalledWith(7);
  });
});
