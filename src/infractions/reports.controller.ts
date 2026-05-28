import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CondominiumAccessGuard } from '../common/guards/condominium-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import { InfractionsService } from './infractions.service';
import { PdfService } from 'src/pdf/pdf.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CondominiumAccessGuard)
@Roles(SystemRole.GERENTE, SystemRole.FUNCIONARIO)
@Controller('condominiums/:condominiumId/infractions')
export class ReportsController {
  constructor(
    private readonly infractionsService: InfractionsService,
    private readonly pdfService: PdfService,
  ) {}

  @ApiOperation({
    summary:
      'Download do relatório PDF de infrações do condomínio (ADMIN ou MANAGER)',
  })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'PDF gerado',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão (requer ADMIN ou MANAGER)',
  })
  @Get('report.pdf')
  async getReport(
    @Param('condominiumId', ParseIntPipe) condominiumId: number,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { condominium, infractions } =
      await this.infractionsService.findForReport(
        condominiumId,
        query.from,
        query.to,
      );

    const datePart = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="infractions-${condominiumId}-${datePart}.pdf"`,
    });

    await this.pdfService.streamInfractionReport(res, condominium, infractions);
  }
}
