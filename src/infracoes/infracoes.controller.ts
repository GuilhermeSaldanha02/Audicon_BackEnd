import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfracoesService } from './infracoes.service';
import { CreateInfracaoDto } from './dto/create-infracao.dto';
import { UpdateInfracaoDto } from './dto/update-infracao.dto';

@UseGuards(JwtAuthGuard)
@Controller('condominios/:condominioId/unidades/:unidadeId/infracoes')
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
    return this.infracoesService.findAllByUnidade(unidadeId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infracoesService.findOne(id);
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
