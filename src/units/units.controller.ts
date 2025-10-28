import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
@UseGuards(JwtAuthGuard)
@Controller('condominiums/:condominiumId/units')
export class UnitsController {
    constructor(private readonly unitsService: UnitsService) { }
    @Post()
    create(
    @Param('condominiumId', ParseIntPipe)
    condominiumId: number, 
    @Body()
    createUnitDto: CreateUnitDto) {
        return this.unitsService.create(condominiumId, createUnitDto);
    }
    @Get()
    findAll(
    @Param('condominiumId', ParseIntPipe)
    condominiumId: number) {
        return this.unitsService.findAll(condominiumId);
    }
    @Get(':id')
    findOne(
    @Param('id', ParseIntPipe)
    id: number) {
        return this.unitsService.findOne(id);
    }
    @Patch(':id')
    update(
    @Param('id', ParseIntPipe)
    id: number, 
    @Body()
    updateUnitDto: UpdateUnitDto) {
        return this.unitsService.update(id, updateUnitDto);
    }
    @Delete(':id')
    remove(
    @Param('id', ParseIntPipe)
    id: number) {
        return this.unitsService.remove(id);
    }
}
