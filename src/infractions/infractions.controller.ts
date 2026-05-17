import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  ParseIntPipe,
  Res,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionsService } from './infractions.service';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';
import { ApproveInfractionDto } from './dto/approve-infraction.dto';
import { InfractionQueryDto } from './dto/infraction-query.dto';

@ApiTags('Infractions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('infractions')
export class InfractionsController {
  constructor(private readonly infractionsService: InfractionsService) {}

  @ApiOperation({ summary: 'Criar infração' })
  @ApiResponse({
    status: 201,
    description: 'Infração criada com status pending',
  })
  @Post()
  create(@Body() dto: CreateInfractionDto) {
    return this.infractionsService.create(dto);
  }

  @ApiOperation({ summary: 'Listar infrações (filtrar por unidade, paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de infrações' })
  @Get()
  findAll(@Query() query: InfractionQueryDto) {
    const { unitId, ...pagination } = query;
    return this.infractionsService.findAll(pagination, unitId);
  }

  @ApiOperation({ summary: 'Buscar infração por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração encontrada' })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.findOne(id);
  }

  @ApiOperation({
    summary: 'Analisar infração via IA (Gemini) — limite: 10 req/min',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Infração analisada, status → analyzed',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas requisições — aguarde antes de tentar novamente',
  })
  @ApiResponse({ status: 502, description: 'Erro na API Gemini' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':id/analyze')
  analyze(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.analyze(id);
  }

  @ApiOperation({ summary: 'Download do documento PDF da infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'PDF gerado',
    content: { 'application/pdf': {} },
  })
  @Get(':id/document')
  async generateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.infractionsService.generateDocument(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=infraction-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @ApiOperation({
    summary:
      'Aprovar infração analisada (status analyzed → approved). Permite override opcional dos campos.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Infração aprovada, status → approved',
  })
  @ApiResponse({
    status: 400,
    description: 'Infração não está no status analyzed',
  })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @Patch(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveInfractionDto,
  ) {
    return this.infractionsService.approve(id, dto);
  }

  @ApiOperation({
    summary:
      'Enviar infração aprovada por e-mail ao morador (status approved → sent).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'E-mail enviado, status → sent',
  })
  @ApiResponse({
    status: 400,
    description:
      'Infração não está no status approved ou unidade sem e-mail cadastrado',
  })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @Post(':id/send')
  send(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.send(id);
  }

  @ApiOperation({ summary: 'Atualizar infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração atualizada' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInfractionDto,
  ) {
    return this.infractionsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Remover infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração removida' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.remove(id);
  }
}
