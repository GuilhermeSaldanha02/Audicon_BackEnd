import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionsService } from './infractions.service';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';

@UseGuards(JwtAuthGuard)
@Controller('units/:unitId/infractions')
export class InfractionsController {
  constructor(private readonly infractionsService: InfractionsService) {}

  @Post()
  create(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Body() dto: CreateInfractionDto,
  ) {
    return this.infractionsService.create(unitId, dto);
  }

  @Get()
  findAll(
    @Param('unitId', ParseIntPipe) unitId: number,
  ) {
    return this.infractionsService.findAll(unitId);
  }

  @Get(':id')
  findOne(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.infractionsService.findOne(unitId, id);
  }

  @Post(':id/analyze')
  analyze(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.infractionsService.analyze(unitId, id);
  }

  @Get(':id/document')
  async generateDocument(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.infractionsService.generateDocument(unitId, id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=infraction-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Patch(':id')
  update(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInfractionDto,
  ) {
    return this.infractionsService.update(unitId, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.infractionsService.remove(unitId, id);
  }
}
