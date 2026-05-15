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
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CondominiumsService } from './condominiums.service';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Condominiums')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('condominiums')
export class CondominiumsController {
  constructor(private readonly condominiumsService: CondominiumsService) {}

  @ApiOperation({ summary: 'Criar condomínio (criador recebe papel ADMIN)' })
  @ApiResponse({ status: 201, description: 'Condomínio criado' })
  @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
  @Post()
  create(
    @Request() req: any,
    @Body() createCondominiumDto: CreateCondominiumDto,
  ) {
    return this.condominiumsService.create(createCondominiumDto, req.user.id);
  }

  @ApiOperation({ summary: 'Listar condomínios do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de condomínios do usuário' })
  @Get()
  findAll(@Request() req: any) {
    return this.condominiumsService.findAll(req.user.id);
  }

  @ApiOperation({ summary: 'Buscar condomínio por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Condomínio encontrado' })
  @ApiResponse({ status: 403, description: 'Sem acesso a este condomínio' })
  @ApiResponse({ status: 404, description: 'Condomínio não encontrado' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RESIDENT)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.condominiumsService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar condomínio (requer ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Condomínio atualizado' })
  @ApiResponse({ status: 403, description: 'Apenas ADMIN pode editar' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCondominiumDto: UpdateCondominiumDto,
  ) {
    return this.condominiumsService.update(id, updateCondominiumDto);
  }

  @ApiOperation({ summary: 'Remover condomínio (requer ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Condomínio removido' })
  @ApiResponse({ status: 403, description: 'Apenas ADMIN pode remover' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.condominiumsService.remove(id);
  }

  @ApiOperation({ summary: 'Adicionar membro ao condomínio (requer ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Membro adicionado ou papel atualizado',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/members')
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.condominiumsService.addMember(id, addMemberDto);
  }
}
