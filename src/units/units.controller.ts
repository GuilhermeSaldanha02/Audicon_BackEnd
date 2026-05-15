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
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('condominiums/:condominiumId/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Param('condominiumId', ParseIntPipe) condominiumId: number,
    @Body() createUnitDto: CreateUnitDto,
  ) {
    return this.unitsService.create(condominiumId, createUnitDto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RESIDENT)
  @Get()
  findAll(@Param('condominiumId', ParseIntPipe) condominiumId: number) {
    return this.unitsService.findAll(condominiumId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RESIDENT)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, updateUnitDto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.remove(id);
  }
}
