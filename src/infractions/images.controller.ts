import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionAccessGuard } from 'src/common/guards/infraction-access.guard';
import { ImagesService, MAX_IMAGE_BYTES } from './images.service';

@ApiTags('Infraction Images')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, InfractionAccessGuard)
@Controller('infractions/:id/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @ApiOperation({
    summary:
      'Upload de imagem da infração (JPEG, PNG ou WebP; máx 5MB; até 10 imagens)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Imagem salva' })
  @ApiResponse({
    status: 400,
    description: 'Arquivo inválido, MIME não suportado ou limite excedido',
  })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  upload(
    @Param('id', ParseIntPipe) infractionId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.upload(infractionId, file);
  }

  @ApiOperation({ summary: 'Listar metadados das imagens da infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Lista de metadados' })
  @Get()
  list(@Param('id', ParseIntPipe) infractionId: number) {
    return this.imagesService.listByInfraction(infractionId);
  }

  @ApiOperation({ summary: 'Download da imagem (binário)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'imageId', type: Number })
  @ApiResponse({ status: 200, description: 'Imagem retornada' })
  @ApiResponse({ status: 404, description: 'Imagem não encontrada' })
  @Get(':imageId')
  async download(
    @Param('id', ParseIntPipe) infractionId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Res() res: Response,
  ) {
    const { filename, mimetype, content } = await this.imagesService.download(
      infractionId,
      imageId,
    );
    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': content.length,
    });
    res.end(content);
  }

  @ApiOperation({ summary: 'Remover imagem da infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'imageId', type: Number })
  @ApiResponse({ status: 200, description: 'Imagem removida' })
  @ApiResponse({ status: 404, description: 'Imagem não encontrada' })
  @Delete(':imageId')
  remove(
    @Param('id', ParseIntPipe) infractionId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    return this.imagesService.remove(infractionId, imageId);
  }
}
