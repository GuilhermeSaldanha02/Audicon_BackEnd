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
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CondominiumsService } from './condominiums.service';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CondominiumAccessGuard } from '../common/guards/condominium-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Actor } from '../audit/audit.service';

@ApiTags('Condominiums')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('condominiums')
export class CondominiumsController {
  constructor(private readonly condominiumsService: CondominiumsService) {}

  @ApiOperation({
    summary: 'Criar condomínio para uma empresa (apenas master)',
  })
  @ApiResponse({ status: 201, description: 'Condomínio criado' })
  @ApiResponse({ status: 403, description: 'Apenas master pode criar' })
  @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
  @UseGuards(MasterGuard)
  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body() createCondominiumDto: CreateCondominiumDto,
  ) {
    return this.condominiumsService.create(createCondominiumDto, actor);
  }

  @ApiOperation({ summary: 'Listar condomínios do usuário autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de condomínios do usuário',
  })
  @Get()
  findAll(@CurrentActor() actor: Actor, @Query() pagination: PaginationDto) {
    return this.condominiumsService.findAll(
      actor.userId,
      pagination,
      actor.companyId,
    );
  }

  @ApiOperation({ summary: 'Buscar condomínio por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Condomínio encontrado' })
  @ApiResponse({ status: 403, description: 'Sem acesso a este condomínio' })
  @ApiResponse({ status: 404, description: 'Condomínio não encontrado' })
  @UseGuards(RolesGuard, CondominiumAccessGuard)
  @Roles(SystemRole.GERENTE, SystemRole.FUNCIONARIO)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.condominiumsService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar condomínio (requer ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Condomínio atualizado' })
  @ApiResponse({ status: 403, description: 'Apenas ADMIN pode editar' })
  @UseGuards(RolesGuard, CondominiumAccessGuard)
  @Roles(SystemRole.GERENTE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCondominiumDto: UpdateCondominiumDto,
  ) {
    return this.condominiumsService.update(id, updateCondominiumDto);
  }

  @ApiOperation({ summary: 'Remover condomínio (apenas master)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Condomínio removido' })
  @ApiResponse({ status: 403, description: 'Apenas master pode remover' })
  @UseGuards(MasterGuard)
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.condominiumsService.remove(id, actor);
  }

  @ApiOperation({ summary: 'Adicionar membro ao condomínio (requer ADMIN)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Membro adicionado ou papel atualizado',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @UseGuards(RolesGuard, CondominiumAccessGuard)
  @Roles(SystemRole.GERENTE)
  @Post(':id/members')
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.condominiumsService.addMember(id, addMemberDto);
  }

  @ApiOperation({ summary: 'Remover membro do condomínio (requer ADMIN)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID do condomínio' })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'ID do usuário a remover',
  })
  @ApiResponse({ status: 200, description: 'Membro removido' })
  @ApiResponse({
    status: 400,
    description: 'Não é possível remover o último ADMIN',
  })
  @ApiResponse({
    status: 404,
    description: 'Condomínio ou membro não encontrado',
  })
  @UseGuards(RolesGuard, CondominiumAccessGuard)
  @Roles(SystemRole.GERENTE)
  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.condominiumsService.removeMember(id, userId);
  }

  @ApiOperation({ summary: 'Upload do PDF de regimento (PDF, máx 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'Regimento salvo' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido ou ausente' })
  @UseGuards(RolesGuard, CondominiumAccessGuard)
  @Roles(SystemRole.GERENTE)
  @Post(':id/regimento')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadRegimento(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo obrigatório no campo "file".');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Apenas PDF é aceito.');
    }
    return this.condominiumsService.setRegimento(
      id,
      file.originalname,
      file.buffer,
    );
  }

  @ApiOperation({ summary: 'Download do PDF de regimento' })
  @ApiResponse({ status: 200, description: 'PDF retornado' })
  @ApiResponse({ status: 404, description: 'Regimento não cadastrado' })
  @UseGuards(CondominiumAccessGuard)
  @Get(':id/regimento')
  async downloadRegimento(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { filename, content } =
      await this.condominiumsService.getRegimento(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': content.length,
    });
    res.end(content);
  }

  @ApiOperation({ summary: 'Remove o regimento cadastrado' })
  @ApiResponse({ status: 200, description: 'Regimento removido' })
  @UseGuards(RolesGuard, CondominiumAccessGuard)
  @Roles(SystemRole.GERENTE)
  @Delete(':id/regimento')
  removeRegimento(@Param('id', ParseIntPipe) id: number) {
    return this.condominiumsService.deleteRegimento(id);
  }
}
