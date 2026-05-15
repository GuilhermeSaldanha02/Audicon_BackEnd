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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionsService } from './infractions.service';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';

@ApiTags('Infractions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('infractions')
export class InfractionsController {
  constructor(private readonly infractionsService: InfractionsService) {}

  @ApiOperation({ summary: 'Criar infração' })
  @ApiResponse({ status: 201, description: 'Infração criada com status pending' })
  @Post()
  create(@Body() dto: CreateInfractionDto) {
    return this.infractionsService.create(dto);
  }

  @ApiOperation({ summary: 'Listar infrações (filtrar por unidade)' })
  @ApiQuery({ name: 'unitId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de infrações' })
  @Get()
  findAll(
    @Query('unitId', new ParseIntPipe({ optional: true })) unitId?: number,
  ) {
    return this.infractionsService.findAll(unitId);
  }

  @ApiOperation({ summary: 'Buscar infração por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração encontrada' })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.findOne(id);
  }

  @ApiOperation({ summary: 'Analisar infração via IA (Gemini) — limite: 10 req/min' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração analisada, status → analyzed' })
  @ApiResponse({ status: 429, description: 'Muitas requisições — aguarde antes de tentar novamente' })
  @ApiResponse({ status: 502, description: 'Erro na API Gemini' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':id/analyze')
  analyze(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.analyze(id);
  }

  @ApiOperation({ summary: 'Download do documento PDF da infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'PDF gerado', content: { 'application/pdf': {} } })
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
