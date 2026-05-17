import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImagesService, MAX_IMAGES_PER_INFRACTION } from './images.service';
import { Infraction } from './entities/infraction.entity';
import { InfractionImage } from './entities/infraction-image.entity';

describe('ImagesService', () => {
  let service: ImagesService;
  let infractionsRepo: any;
  let imagesRepo: any;
  let qb: any;

  const file = (overrides: Partial<Express.Multer.File> = {}): any => ({
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('image-bytes'),
    ...overrides,
  });

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        {
          provide: getRepositoryToken(Infraction),
          useValue: { findOne: jest.fn(), exist: jest.fn() },
        },
        {
          provide: getRepositoryToken(InfractionImage),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn(),
            count: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
        },
      ],
    }).compile();
    service = module.get(ImagesService);
    infractionsRepo = module.get(getRepositoryToken(Infraction));
    imagesRepo = module.get(getRepositoryToken(InfractionImage));
  });

  describe('upload', () => {
    it('salva imagem válida e retorna metadata sem content', async () => {
      infractionsRepo.findOne.mockResolvedValue({ id: 1 });
      imagesRepo.count.mockResolvedValue(0);
      imagesRepo.save.mockResolvedValue({
        id: 99,
        filename: 'photo.jpg',
        mimetype: 'image/jpeg',
        sizeBytes: 1024,
        uploadedAt: new Date('2026-05-17T12:00:00Z'),
      });
      const result = await service.upload(1, file());
      expect(result).toEqual({
        id: 99,
        filename: 'photo.jpg',
        mimetype: 'image/jpeg',
        sizeBytes: 1024,
        uploadedAt: expect.any(Date),
      });
    });
    it('rejeita sem arquivo', async () => {
      await expect(service.upload(1, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
    it('rejeita MIME não suportado', async () => {
      await expect(
        service.upload(1, file({ mimetype: 'application/pdf' })),
      ).rejects.toThrow(/não suportado/);
    });
    it('rejeita arquivo > 5MB', async () => {
      await expect(
        service.upload(1, file({ size: 6 * 1024 * 1024 })),
      ).rejects.toThrow(/tamanho máximo/);
    });
    it('rejeita quando infração não existe', async () => {
      infractionsRepo.findOne.mockResolvedValue(null);
      await expect(service.upload(999, file())).rejects.toThrow(
        NotFoundException,
      );
    });
    it('rejeita quando já atingiu limite de 10 imagens', async () => {
      infractionsRepo.findOne.mockResolvedValue({ id: 1 });
      imagesRepo.count.mockResolvedValue(MAX_IMAGES_PER_INFRACTION);
      await expect(service.upload(1, file())).rejects.toThrow(/Limite/);
    });
  });

  describe('listByInfraction', () => {
    it('retorna metadatas quando infração existe', async () => {
      infractionsRepo.exist.mockResolvedValue(true);
      imagesRepo.find.mockResolvedValue([
        {
          id: 1,
          filename: 'a.jpg',
          mimetype: 'image/jpeg',
          sizeBytes: 100,
          uploadedAt: new Date(),
        },
      ]);
      const result = await service.listByInfraction(5);
      expect(result).toHaveLength(1);
      expect(imagesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { infraction: { id: 5 } },
          select: ['id', 'filename', 'mimetype', 'sizeBytes', 'uploadedAt'],
        }),
      );
    });
    it('lança NotFound quando infração não existe', async () => {
      infractionsRepo.exist.mockResolvedValue(false);
      await expect(service.listByInfraction(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('download', () => {
    it('retorna content + metadata quando imagem existe', async () => {
      qb.getOne.mockResolvedValue({
        filename: 'p.jpg',
        mimetype: 'image/jpeg',
        content: Buffer.from('bin'),
      });
      const result = await service.download(1, 7);
      expect(result.filename).toBe('p.jpg');
      expect(Buffer.isBuffer(result.content)).toBe(true);
    });
    it('lança NotFound quando imagem não pertence à infração', async () => {
      qb.getOne.mockResolvedValue(null);
      await expect(service.download(1, 7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deleta quando imagem existe e pertence à infração', async () => {
      imagesRepo.findOne.mockResolvedValue({ id: 7 });
      await service.remove(1, 7);
      expect(imagesRepo.delete).toHaveBeenCalledWith(7);
    });
    it('lança NotFound quando imagem não existe', async () => {
      imagesRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getContentBuffers', () => {
    it('retorna até 4 buffers ordenados por uploadedAt ASC', async () => {
      qb.getMany.mockResolvedValue([
        { content: Buffer.from('a') },
        { content: Buffer.from('b') },
      ]);
      const result = await service.getContentBuffers(1);
      expect(result).toHaveLength(2);
      expect(qb.limit).toHaveBeenCalledWith(4);
    });
  });
});
