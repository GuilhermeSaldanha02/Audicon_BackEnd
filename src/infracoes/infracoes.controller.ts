import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfracoesService } from './infracoes.service';
import { CreateInfracaoDto } from './dto/create-infracao.dto';
import { UpdateInfracaoDto } from './dto/update-infracao.dto';

@UseGuards(JwtAuthGuard)
@Controller('unidades/:unidadeId/infracoes')
export class InfracoesController {
  constructor(private readonly infracoesService: InfracoesService) {}

  @Post()
  create(
    @Param('unidadeId', ParseIntPipe) unidadeId: number,
    @Body() dto: CreateInfracaoDto,
  ) {
    return this.infracoesService.create(unidadeId, dto);
  }

  @Get()
  findAll(
    @Param('unidadeId', ParseIntPipe) unidadeId: number,
  ) {
    return this.infracoesService.findAll(unidadeId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infracoesService.findOne(id);
  }

  @Post(':id/analisar')
  analisar(@Param('id', ParseIntPipe) id: number) {
    return this.infracoesService.analisar(id);
  }

  @Get(':id/documento')
  async gerarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.infracoesService.gerarDocumento(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=infracao-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInfracaoDto,
  ) {
    return this.infracoesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.infracoesService.remove(id);
  }
}
