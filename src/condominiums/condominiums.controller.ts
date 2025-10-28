import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, } from '@nestjs/common';
import { CondominiumsService } from './condominiums.service';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
@UseGuards(JwtAuthGuard)
@Controller('condominiums')
export class CondominiumsController {
    constructor(private readonly condominiumsService: CondominiumsService) { }
    @Post()
    create(
    @Body()
    createCondominiumDto: CreateCondominiumDto) {
        return this.condominiumsService.create(createCondominiumDto);
    }
    @Get()
    findAll() {
        return this.condominiumsService.findAll();
    }
    @Get(':id')
    findOne(
    @Param('id', ParseIntPipe)
    id: number) {
        return this.condominiumsService.findOne(id);
    }
    @Patch(':id')
    update(
    @Param('id', ParseIntPipe)
    id: number, 
    @Body()
    updateCondominiumDto: UpdateCondominiumDto) {
        return this.condominiumsService.update(id, updateCondominiumDto);
    }
    @Delete(':id')
    remove(
    @Param('id', ParseIntPipe)
    id: number) {
        return this.condominiumsService.remove(id);
    }
}
