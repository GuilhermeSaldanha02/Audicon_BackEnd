import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { UnidadesService } from './unidades.service';
import { CreateUnidadeDto } from './dto/create-unidade.dto';
import { UpdateUnidadeDto } from './dto/update-unidade.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('condominios/:condominioId/unidades')
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  @Post()
  create(
    @Param('condominioId', ParseIntPipe) condominioId: number,
    @Body() createUnidadeDto: CreateUnidadeDto,
  ) {
    return this.unidadesService.create(condominioId, createUnidadeDto);
  }

  @Get()
  findAll(@Param('condominioId', ParseIntPipe) condominioId: number) {
    return this.unidadesService.findAll(condominioId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unidadesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUnidadeDto: UpdateUnidadeDto,
  ) {
    return this.unidadesService.update(id, updateUnidadeDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unidadesService.remove(id);
  }
}
