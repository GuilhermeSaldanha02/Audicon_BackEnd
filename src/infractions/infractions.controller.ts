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
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionsService } from './infractions.service';
import { CreateInfractionDto } from './dto/create-infraction.dto';
import { UpdateInfractionDto } from './dto/update-infraction.dto';

@UseGuards(JwtAuthGuard)
@Controller('infractions')
export class InfractionsController {
  constructor(private readonly infractionsService: InfractionsService) {}

  @Post()
  create(@Body() dto: CreateInfractionDto) {
    return this.infractionsService.create(dto);
  }

  @Get()
  findAll(
    @Query('unitId', new ParseIntPipe({ optional: true })) unitId?: number,
  ) {
    return this.infractionsService.findAll(unitId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.findOne(id);
  }

  @Post(':id/analyze')
  analyze(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.analyze(id);
  }

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

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInfractionDto,
  ) {
    return this.infractionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.infractionsService.remove(id);
  }
}
