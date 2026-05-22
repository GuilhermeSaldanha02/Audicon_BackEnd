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
import { InfractionAccessGuard } from 'src/common/guards/infraction-access.guard';
import { InfractionsService } from './infractions.service';
import { InfractionAnalysisService } from './infraction-analysis.service';
import { InfractionNotificationService } from './infraction-notification.service';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';
import { ApproveInfractionDto } from './dto/approve-infraction.dto';
import { InfractionQueryDto } from './dto/infraction-query.dto';
import { CsvExportQueryDto } from './dto/csv-export-query.dto';
import { CurrentActor } from 'src/common/decorators/current-actor.decorator';
import { Actor } from 'src/audit/audit.service';

@ApiTags('Infractions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('infractions')
export class InfractionsController {
  constructor(
    private readonly infractionsService: InfractionsService,
    private readonly infractionAnalysisService: InfractionAnalysisService,
    private readonly infractionNotificationService: InfractionNotificationService,
  ) {}

  @ApiOperation({ summary: 'Criar infração' })
  @ApiResponse({
    status: 201,
    description: 'Infração criada com status pending',
  })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateInfractionDto) {
    return this.infractionsService.create(
      dto,
      actor.companyId,
      actor.isMaster,
      actor,
    );
  }

  @ApiOperation({ summary: 'Listar infrações (filtrar por unidade, paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de infrações' })
  @Get()
  findAll(@CurrentActor() actor: Actor, @Query() query: InfractionQueryDto) {
    const { unitId, ...pagination } = query;
    return this.infractionsService.findAll(
      pagination,
      unitId,
      actor.companyId,
      actor.isMaster,
    );
  }

  @ApiOperation({ summary: 'Exportar infrações em CSV (sem paginação)' })
  @ApiResponse({
    status: 200,
    description: 'Arquivo CSV',
    content: { 'text/csv': {} },
  })
  @Get('export')
  async exportCsv(
    @CurrentActor() actor: Actor,
    @Query() query: CsvExportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.infractionsService.exportCsv(
      query,
      actor.companyId,
      actor.isMaster,
    );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=infractions.csv',
    });
    res.end(csv);
  }

  @ApiOperation({ summary: 'Buscar infração por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração encontrada' })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @UseGuards(InfractionAccessGuard)
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
  @UseGuards(InfractionAccessGuard)
  @Post(':id/analyze')
  analyze(@Param('id', ParseIntPipe) id: number) {
    return this.infractionAnalysisService.analyze(id);
  }

  @ApiOperation({ summary: 'Download do documento PDF da infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'PDF gerado',
    content: { 'application/pdf': {} },
  })
  @UseGuards(InfractionAccessGuard)
  @Get(':id/document')
  async generateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer =
      await this.infractionNotificationService.generateDocument(id);
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
  @UseGuards(InfractionAccessGuard)
  @Patch(':id/approve')
  approve(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveInfractionDto,
  ) {
    return this.infractionsService.approve(id, dto, actor);
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
  @UseGuards(InfractionAccessGuard)
  @Post(':id/send')
  send(@CurrentActor() actor: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.infractionNotificationService.send(id, actor);
  }

  @ApiOperation({
    summary:
      'Enviar alerta por WhatsApp (canal complementar; não muda o status principal).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp enviado, whatsappSentAt preenchido',
  })
  @ApiResponse({
    status: 400,
    description: 'Status diferente de approved/sent ou unidade sem telefone',
  })
  @ApiResponse({ status: 404, description: 'Infração não encontrada' })
  @UseGuards(InfractionAccessGuard)
  @Post(':id/send-whatsapp')
  sendWhatsapp(
    @CurrentActor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.infractionNotificationService.sendWhatsapp(id, actor);
  }

  @ApiOperation({ summary: 'Atualizar infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Infração atualizada' })
  @UseGuards(InfractionAccessGuard)
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
  @UseGuards(InfractionAccessGuard)
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.remove(id, actor);
  }
}
