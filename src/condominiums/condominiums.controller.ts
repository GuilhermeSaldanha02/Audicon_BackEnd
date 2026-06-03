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
  ApiCookieAuth,
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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CondominiumAccessGuard } from '../common/guards/condominium-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Actor } from '../audit/audit.service';
import {
  CondominiumResponseDto,
  PaginatedCondominiumsDto,
} from './dto/condominium-response.dto';

@ApiTags('Condominiums')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('condominiums')
export class CondominiumsController {
  constructor(private readonly condominiumsService: CondominiumsService) {}

  @ApiOperation({
    summary: 'Criar condomínio (master para qualquer empresa; gerente na sua)',
    description:
      'MASTER cria para qualquer empresa (companyId no body, obrigatório). ' +
      'GERENTE cria apenas na própria empresa (companyId vem do token, o do ' +
      'body é ignorado). FUNCIONARIO não pode criar.',
  })
  @ApiResponse({
    status: 201,
    description: 'Condomínio criado',
    type: CondominiumResponseDto,
  })
  @ApiResponse({ status: 400, description: 'companyId ausente (master)' })
  @ApiResponse({
    status: 403,
    description: 'Papel sem permissão (funcionário)',
  })
  @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
  @UseGuards(RolesGuard)
  @Roles(SystemRole.MASTER, SystemRole.GERENTE)
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
    type: PaginatedCondominiumsDto,
  })
  @Get()
  findAll(@CurrentActor() actor: Actor, @Query() pagination: PaginationDto) {
    return this.condominiumsService.findAll(pagination, actor);
  }

  @ApiOperation({ summary: 'Buscar condomínio por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Condomínio encontrado',
    type: CondominiumResponseDto,
  })
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
  @ApiResponse({
    status: 200,
    description: 'Condomínio atualizado',
    type: CondominiumResponseDto,
  })
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
