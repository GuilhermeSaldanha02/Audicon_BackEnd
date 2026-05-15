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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('condominiums/:condominiumId/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @ApiOperation({ summary: 'Criar unidade no condomínio (ADMIN ou MANAGER)' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiResponse({ status: 201, description: 'Unidade criada' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Param('condominiumId', ParseIntPipe) condominiumId: number,
    @Body() createUnitDto: CreateUnitDto,
  ) {
    return this.unitsService.create(condominiumId, createUnitDto);
  }

  @ApiOperation({ summary: 'Listar unidades do condomínio' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RESIDENT)
  @Get()
  findAll(@Param('condominiumId', ParseIntPipe) condominiumId: number) {
    return this.unitsService.findAll(condominiumId);
  }

  @ApiOperation({ summary: 'Buscar unidade por ID' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Unidade encontrada' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RESIDENT)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar unidade (ADMIN ou MANAGER)' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Unidade atualizada' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, updateUnitDto);
  }

  @ApiOperation({ summary: 'Remover unidade (ADMIN)' })
  @ApiParam({ name: 'condominiumId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Unidade removida' })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.remove(id);
  }
}
