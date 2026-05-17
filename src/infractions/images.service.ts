import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infraction } from './entities/infraction.entity';
import { InfractionImage } from './entities/infraction-image.entity';

export const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES_PER_INFRACTION = 10;

export interface ImageMetadata {
  id: number;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  uploadedAt: Date;
}

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Infraction)
    private readonly infractionsRepository: Repository<Infraction>,
    @InjectRepository(InfractionImage)
    private readonly imagesRepository: Repository<InfractionImage>,
  ) {}

  async upload(
    infractionId: number,
    file: Express.Multer.File,
  ): Promise<ImageMetadata> {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório no campo "file".');
    }
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não suportado: ${file.mimetype}. Aceitos: ${ALLOWED_IMAGE_MIMETYPES.join(', ')}.`,
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `Arquivo excede o tamanho máximo de ${MAX_IMAGE_BYTES} bytes.`,
      );
    }

    const infraction = await this.infractionsRepository.findOne({
      where: { id: infractionId },
    });
    if (!infraction) {
      throw new NotFoundException(
        `Infraction with ID #${infractionId} not found.`,
      );
    }

    const currentCount = await this.imagesRepository.count({
      where: { infraction: { id: infractionId } },
    });
    if (currentCount >= MAX_IMAGES_PER_INFRACTION) {
      throw new BadRequestException(
        `Limite de ${MAX_IMAGES_PER_INFRACTION} imagens por infração atingido.`,
      );
    }

    const image = this.imagesRepository.create({
      filename: file.originalname,
      mimetype: file.mimetype,
      sizeBytes: file.size,
      content: file.buffer,
      infraction,
    });
    const saved = await this.imagesRepository.save(image);
    return {
      id: saved.id,
      filename: saved.filename,
      mimetype: saved.mimetype,
      sizeBytes: saved.sizeBytes,
      uploadedAt: saved.uploadedAt,
    };
  }

  async listByInfraction(infractionId: number): Promise<ImageMetadata[]> {
    const exists = await this.infractionsRepository.exist({
      where: { id: infractionId },
    });
    if (!exists) {
      throw new NotFoundException(
        `Infraction with ID #${infractionId} not found.`,
      );
    }
    return this.imagesRepository.find({
      where: { infraction: { id: infractionId } },
      select: ['id', 'filename', 'mimetype', 'sizeBytes', 'uploadedAt'],
      order: { uploadedAt: 'ASC' },
    });
  }

  async download(
    infractionId: number,
    imageId: number,
  ): Promise<{ filename: string; mimetype: string; content: Buffer }> {
    const image = await this.imagesRepository
      .createQueryBuilder('img')
      .leftJoin('img.infraction', 'infraction')
      .addSelect('img.content')
      .where('img.id = :imageId', { imageId })
      .andWhere('infraction.id = :infractionId', { infractionId })
      .getOne();
    if (!image) {
      throw new NotFoundException(
        `Image #${imageId} not found for infraction #${infractionId}.`,
      );
    }
    return {
      filename: image.filename,
      mimetype: image.mimetype,
      content: image.content,
    };
  }

  async remove(infractionId: number, imageId: number): Promise<void> {
    const image = await this.imagesRepository.findOne({
      where: { id: imageId, infraction: { id: infractionId } },
      relations: ['infraction'],
    });
    if (!image) {
      throw new NotFoundException(
        `Image #${imageId} not found for infraction #${infractionId}.`,
      );
    }
    await this.imagesRepository.delete(imageId);
  }

  async getContentBuffers(infractionId: number): Promise<Buffer[]> {
    const images = await this.imagesRepository
      .createQueryBuilder('img')
      .leftJoin('img.infraction', 'infraction')
      .addSelect('img.content')
      .where('infraction.id = :infractionId', { infractionId })
      .orderBy('img.uploadedAt', 'ASC')
      .limit(4)
      .getMany();
    return images.map((i) => i.content);
  }
}
