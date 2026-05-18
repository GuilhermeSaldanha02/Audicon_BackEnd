import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InfractionAccessGuard } from '../common/guards/infraction-access.guard';

describe('ImagesController', () => {
  let controller: ImagesController;
  let service: {
    upload: jest.Mock;
    listByInfraction: jest.Mock;
    download: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      upload: jest.fn(),
      listByInfraction: jest.fn(),
      download: jest.fn(),
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [{ provide: ImagesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InfractionAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ImagesController);
  });

  it('upload delega ao service com id e file', async () => {
    const file: any = { originalname: 'p.jpg' };
    service.upload.mockResolvedValue({ id: 1 });
    const result = await controller.upload(5, file);
    expect(service.upload).toHaveBeenCalledWith(5, file);
    expect(result).toEqual({ id: 1 });
  });

  it('list delega ao service', async () => {
    service.listByInfraction.mockResolvedValue([{ id: 1 }]);
    const result = await controller.list(5);
    expect(service.listByInfraction).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('download escreve headers corretos e finaliza response', async () => {
    service.download.mockResolvedValue({
      filename: 'p.jpg',
      mimetype: 'image/jpeg',
      content: Buffer.from('bin'),
    });
    const res: any = { set: jest.fn(), end: jest.fn() };
    await controller.download(5, 7, res);
    expect(service.download).toHaveBeenCalledWith(5, 7);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline; filename="p.jpg"',
      }),
    );
    expect(res.end).toHaveBeenCalled();
  });

  it('remove delega ao service', async () => {
    service.remove.mockResolvedValue(undefined);
    const result = await controller.remove(5, 7);
    expect(service.remove).toHaveBeenCalledWith(5, 7);
    expect(result).toBeUndefined();
  });
});
