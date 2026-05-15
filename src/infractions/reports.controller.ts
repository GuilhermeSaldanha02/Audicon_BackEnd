import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionsService } from './infractions.service';
import { PdfService } from 'src/pdf/pdf.service';
import { ReportQueryDto } from './dto/report-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('condominiums/:condominiumId/infractions')
export class ReportsController {
  constructor(
    private readonly infractionsService: InfractionsService,
    private readonly pdfService: PdfService,
  ) {}

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
