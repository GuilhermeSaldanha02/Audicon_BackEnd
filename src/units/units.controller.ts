import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto, PaginatedUnitsDto } from './dto/unit-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CondominiumAccessGuard } from '../common/guards/condominium-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';

@ApiTags('Units')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CondominiumAccessGuard)
@Controller('condominiums/:condominiumId/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @ApiOperation({ summary: 'Criar unidade no condomínio (GERENTE)' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Unidade criada',
    type: UnitResponseDto,
  })
  @Roles(SystemRole.GERENTE)
  @Post()
  create(
    @Param('condominiumId', ParseIntPipe) condominiumId: number,
    @Body() createUnitDto: CreateUnitDto,
  ) {
    return this.unitsService.create(condominiumId, createUnitDto);
  }

  @ApiOperation({ summary: 'Listar unidades do condomínio' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista de unidades',
    type: PaginatedUnitsDto,
  })
  @Roles(SystemRole.GERENTE, SystemRole.FUNCIONARIO)
  @Get()
  findAll(@Param('condominiumId', ParseIntPipe) condominiumId: number) {
    return this.unitsService.findAll(condominiumId);
  }

  @ApiOperation({ summary: 'Buscar unidade por ID' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Unidade encontrada',
    type: UnitResponseDto,
  })
  @Roles(SystemRole.GERENTE, SystemRole.FUNCIONARIO)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar unidade (GERENTE)' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Unidade atualizada',
    type: UnitResponseDto,
  })
  @Roles(SystemRole.GERENTE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, updateUnitDto);
  }

  @ApiOperation({ summary: 'Remover unidade (GERENTE)' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Unidade removida' })
  @Roles(SystemRole.GERENTE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.remove(id);
  }
}
